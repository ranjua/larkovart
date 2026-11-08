import type { Client, Transaction } from "@libsql/client";
const targetStates =
  "'draft','approved','scheduled','queued','processing','published','test_completed','awaiting_creator','manual_ready','manually_reported','blocked','retry_wait','uncertain','failed','canceled'";
const statements = [
  "CREATE TABLE IF NOT EXISTS social_provider_artifacts(job_id TEXT NOT NULL,connection_id TEXT NOT NULL,encrypted_payload TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(job_id))",
  "CREATE TABLE IF NOT EXISTS social_schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_posts(id TEXT PRIMARY KEY,title TEXT NOT NULL,artwork_id TEXT,campaign TEXT NOT NULL,intent TEXT NOT NULL,revision INTEGER NOT NULL,archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  `CREATE TABLE IF NOT EXISTS social_targets(id TEXT PRIMARY KEY,post_id TEXT NOT NULL,provider TEXT NOT NULL,connection_id TEXT,revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN (${targetStates})),scheduled_at TEXT,approved_hash TEXT,approved_snapshot TEXT,data TEXT NOT NULL CHECK(json_valid(data)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(post_id) REFERENCES social_posts(id))`,
  "CREATE TABLE IF NOT EXISTS social_assets(id TEXT PRIMARY KEY,storage_key TEXT NOT NULL,sha256 TEXT NOT NULL,verification_state TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),created_at TEXT NOT NULL,UNIQUE(storage_key,sha256))",
  "CREATE TABLE IF NOT EXISTS social_connections(id TEXT PRIMARY KEY,provider TEXT NOT NULL,external_account_id TEXT NOT NULL,environment TEXT NOT NULL,credential_id TEXT NOT NULL,status TEXT NOT NULL,connection_generation INTEGER NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(provider,external_account_id,environment))",
  "CREATE TABLE IF NOT EXISTS social_credentials(id TEXT PRIMARY KEY,provider TEXT NOT NULL,environment TEXT NOT NULL,encrypted_payload TEXT NOT NULL,key_version TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,access_expires_at INTEGER,refresh_expires_at INTEGER,refresh_lease_owner TEXT,refresh_lease_until INTEGER,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_oauth_states(state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,flow TEXT NOT NULL,browser_binding_hash TEXT NOT NULL,encrypted_verifier TEXT,redirect_uri TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER,environment TEXT NOT NULL,created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_connection_candidates(id TEXT PRIMARY KEY,oauth_state_hash TEXT NOT NULL,provider TEXT NOT NULL,external_resource_id TEXT NOT NULL,encrypted_candidate_payload TEXT NOT NULL,expires_at INTEGER NOT NULL,selected_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS social_jobs(id TEXT PRIMARY KEY,target_id TEXT,connection_id TEXT,kind TEXT NOT NULL,operation_key TEXT NOT NULL UNIQUE,state TEXT NOT NULL CHECK(state IN ('ready','running','retry_wait','done','blocked','uncertain','failed','canceled')),run_at TEXT NOT NULL,lease_owner TEXT,lease_until INTEGER,fence INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 100,payload_json TEXT NOT NULL,last_error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_attempts(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,target_id TEXT,step_key TEXT NOT NULL,attempt_no INTEGER NOT NULL,request_fingerprint TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,outcome TEXT,external_operation_id TEXT,external_post_id TEXT,provider_request_id TEXT,error_code TEXT)",
  // snapshot_key is non-null hash of connection, external-post-or-account, key, period and definition version.
  "CREATE TABLE IF NOT EXISTS social_metrics(id TEXT PRIMARY KEY,snapshot_key TEXT NOT NULL UNIQUE,connection_id TEXT NOT NULL,external_post_id TEXT,metric_key TEXT NOT NULL,value REAL,unit TEXT NOT NULL,aggregation TEXT NOT NULL,period_start TEXT,period_end TEXT,collected_at TEXT NOT NULL,definition_version TEXT NOT NULL,status TEXT NOT NULL,source_json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_webhook_events(provider TEXT NOT NULL,event_key TEXT NOT NULL,connection_id TEXT,received_at TEXT NOT NULL,state TEXT NOT NULL,payload_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,processed_at TEXT,PRIMARY KEY(provider,event_key))",
  "CREATE TABLE IF NOT EXISTS social_audit_events(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,subject_type TEXT NOT NULL,subject_id TEXT NOT NULL,summary_json TEXT NOT NULL,created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_worker_health(worker_id TEXT PRIMARY KEY,mode TEXT NOT NULL,last_started_at TEXT NOT NULL,last_completed_at TEXT,last_error_code TEXT,processed_count INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS social_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS social_request_keys(actor TEXT NOT NULL,operation TEXT NOT NULL,request_key TEXT NOT NULL,body_hash TEXT NOT NULL,resource_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,PRIMARY KEY(actor,operation,request_key))",
  "CREATE TABLE IF NOT EXISTS social_deletion_requests(id TEXT PRIMARY KEY,status TEXT NOT NULL,created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS social_due_jobs ON social_jobs(state,run_at)",
  "CREATE INDEX IF NOT EXISTS social_job_leases ON social_jobs(lease_until)",
  "CREATE INDEX IF NOT EXISTS social_target_schedule ON social_targets(status,scheduled_at)",
  "CREATE INDEX IF NOT EXISTS social_target_post ON social_targets(post_id,provider)",
  "CREATE INDEX IF NOT EXISTS social_attempt_target ON social_attempts(target_id,started_at)",
  "CREATE INDEX IF NOT EXISTS social_oauth_expiry ON social_oauth_states(expires_at)",
];
const queues = new WeakMap<Client, Promise<unknown>>();
const originals = new WeakMap<Client, Client>();
function serial<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  const key = originals.get(client) || client;
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(fn);
  queues.set(
    key,
    current.then(
      () => {},
      () => {},
    ),
  );
  return current;
}
export function serializedClient(client: Client): Client {
  if (originals.has(client)) return client;
  const wrapper = new Proxy(client, {
    get(target, property) {
      if (property === "execute")
        return (statement: Parameters<Client["execute"]>[0]) =>
          serial(target, async () => {
            for (let attempt = 0; ; attempt++) {
              try {
                return await target.execute(statement);
              } catch (e) {
                if (
                  attempt < 6 &&
                  /SQLITE_BUSY|database is locked/.test(String(e))
                ) {
                  await new Promise((r) => setTimeout(r, 20 * 2 ** attempt));
                  continue;
                }
                throw e;
              }
            }
          });
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  originals.set(wrapper, client);
  return wrapper;
}
export async function transaction<T>(
  client: Client,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return serial(client, async () => {
    const raw = originals.get(client) || client;
    for (let attempt = 0; ; attempt++) {
      let tx: Transaction | undefined;
      try {
        tx = await raw.transaction("write");
        const result = await fn(tx);
        await tx.commit();
        return result;
      } catch (e) {
        if (tx) await tx.rollback().catch(() => {});
        if (attempt < 6 && /SQLITE_BUSY|database is locked/.test(String(e))) {
          await new Promise((r) => setTimeout(r, 20 * 2 ** attempt));
          continue;
        }
        throw e;
      } finally {
        tx?.close();
      }
    }
  });
}
export async function migrateSocial(client: Client) {
  await serial(client, async () => {
    const raw = originals.get(client) || client;
    for (let attempt = 0; ; attempt++) {
      try {
        await raw.batch(
          [
            ...statements,
            {
              sql: "INSERT INTO social_schema_migrations(version,applied_at) VALUES (1,?) ON CONFLICT(version) DO NOTHING",
              args: [new Date().toISOString()],
            },
          ],
          "write",
        );
        return;
      } catch (e) {
        if (attempt < 6 && /SQLITE_BUSY|database is locked/.test(String(e))) {
          await new Promise((r) => setTimeout(r, 20 * 2 ** attempt));
          continue;
        }
        throw e;
      }
    }
  });
}
