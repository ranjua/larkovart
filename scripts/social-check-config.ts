import { redactedConfig } from "../src/lib/social/config.ts";
const c = redactedConfig();
console.log(
  JSON.stringify(
    {
      enabled: c.enabled,
      environment: c.environment,
      workerMode: c.mode,
      publicWrites: c.publishEnabled,
      testWrites: c.testWrites,
      hostedSchedulerVerified: c.hostedVerified,
      callbackOriginConfigured: !!c.origin,
      publicStoreVerified: !!c.publicStore,
      graphVersion: c.version,
      providers: c.providers,
    },
    null,
    2,
  ),
);
