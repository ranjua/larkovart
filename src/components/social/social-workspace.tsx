"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Pause,
  Play,
  Download,
  Copy,
  RefreshCw,
  Check,
  CalendarDays,
  ImageIcon,
  Link2,
  LayoutGrid,
  BarChart3,
  Activity,
  FileText,
} from "lucide-react";
import {
  platforms,
  type Platform,
  type Post,
  type Target,
  type Asset,
  type Connection,
  type Job,
} from "@/lib/social/types";
import { captionFor } from "@/lib/social/captions";
import { localSchedule } from "@/lib/social/time";
import { defaultOptions } from "@/lib/social/validation";
import type { Artwork } from "@/lib/catalog";
// Only public state is received. Credentials and OAuth candidate payloads never cross this boundary.
type State = {
  posts: Post[];
  targets: Target[];
  assets: Asset[];
  connections: Connection[];
  jobs: Job[];
  metrics: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  health: Record<string, unknown>[];
  paused: boolean;
  candidates: {
    id: string;
    provider: Platform;
    external_resource_id: string;
    displayName?: string;
  }[];
  config: {
    mode: string;
    publishEnabled: boolean;
    testWrites: boolean;
    origin: string | null;
    providers: Record<Platform, { configured: boolean }>;
  };
  capabilities: Record<
    Platform,
    {
      connection: { state: string; ownerAction?: string };
      publishImage: { state: string; ownerAction?: string };
    }
  >;
};
const names: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook Pages",
  pinterest: "Pinterest",
  tiktok: "TikTok",
};
const labels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  queued: "Queued",
  processing: "Processing",
  published: "Verified public post",
  test_completed: "Creator-only test",
  awaiting_creator: "Finish in the native app",
  manual_ready: "Ready for manual posting",
  manually_reported: "Posted manually · unverified",
  blocked: "Needs attention",
  retry_wait: "Safe retry pending",
  uncertain: "Outcome uncertain",
  failed: "Failed",
  canceled: "Canceled",
};
const tabs = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "content", label: "Content", icon: FileText },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "activity", label: "Activity", icon: Activity },
];
async function api(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const r = await fetch(`/api/studio/social/${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data.error?.message || "This action could not be completed.",
    );
  return data;
}
function targetInput(t: Target) {
  return {
    provider: t.provider,
    connectionId: t.connectionId,
    deliveryMode: t.deliveryMode,
    format: t.format,
    caption: t.caption,
    options: t.options,
    assetIds: t.assetIds,
    linkUrl: t.linkUrl,
    scheduledAt: t.scheduledAt,
    timezone: t.timezone,
  };
}
function localValue(utc: string | null, timezone: string) {
  if (!utc) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utc))
      .map((v) => [v.type, v.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function SocialWorkspace({ artworks }: { artworks: Artwork[] }) {
  const [state, setState] = useState<State | null>(null),
    [tab, setTab] = useState("overview"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [compose, setCompose] = useState(false),
    [attempts, setAttempts] = useState<Record<string, unknown>[]>([]);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const [weekOnly, setWeekOnly] = useState(false),
    [weekStart, setWeekStart] = useState(() =>
      new Date().toISOString().slice(0, 10),
    );
  const reload = async () => setState(await api("status"));
  useEffect(() => {
    let canceled = false;
    api("status")
      .then((s) => {
        if (!canceled) setState(s);
      })
      .catch((e) => {
        if (!canceled) setMessage(e.message);
      });
    return () => {
      canceled = true;
    };
  }, []);
  async function act(fn: () => Promise<unknown>, success = "Saved.") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await reload();
      setMessage(success);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "This action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="social-shell">
      <Link href="/studio" className="social-back">
        <ArrowLeft size={16} />
        Artist studio
      </Link>
      <header className="social-heading">
        <div>
          <p className="eyebrow">LARKOVA / SOCIAL STUDIO</p>
          <h1>Art worth sharing.</h1>
          <p>One collection. Your voice. A considered presence everywhere.</p>
        </div>
        <button
          className="button button-dark"
          onClick={() => {
            setCompose(true);
            setTab("content");
          }}
          disabled={!state}
        >
          <Plus size={17} />
          New campaign
        </button>
      </header>
      <nav className="social-tabs" aria-label="Social workspace">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <p
          ref={feedback}
          className="social-feedback"
          role="alert"
          tabIndex={-1}
        >
          {message}
        </p>
      )}
      {!state ? (
        <p className="social-empty">
          {message
            ? "The workspace could not be loaded. Return to Studio or check social storage setup."
            : "Opening your workspace…"}
        </p>
      ) : (
        <>
          <div className="social-runtime">
            <span className={`social-dot ${state.paused ? "paused" : ""}`} />
            <p>
              <strong>
                {state.paused
                  ? "Publishing paused"
                  : state.config.mode === "manual"
                    ? "Manual worker"
                    : `${state.config.mode} worker configured`}
              </strong>{" "}
              ·{" "}
              {state.config.mode === "manual"
                ? "Scheduled times are saved; jobs run only when you click Run due jobs."
                : "Check the latest heartbeat before relying on unattended scheduling."}{" "}
              Public API writes:{" "}
              {state.config.publishEnabled
                ? "enabled with exact-post approval"
                : "off"}
              .
            </p>
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () => api("settings", { paused: !state.paused }),
                  state.paused
                    ? "Publishing resumed within configured safety gates."
                    : "Publishing paused. In-flight requests may still finish.",
                )
              }
            >
              {state.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {state.paused ? "Resume" : "Pause all"}
            </button>
            <button
              disabled={busy || state.paused}
              onClick={() =>
                act(
                  () => api("jobs/run", {}),
                  "Due jobs checked. Review each destination’s outcome.",
                )
              }
            >
              <Play size={15} />
              Run due jobs
            </button>
          </div>
          {tab === "overview" && (
            <>
              <div className="social-summary">
                {[
                  ["Campaigns", state.posts.length],
                  [
                    "Draft destinations",
                    state.targets.filter((t) => t.status === "draft").length,
                  ],
                  [
                    "Verified public posts",
                    state.targets.filter((t) => t.status === "published")
                      .length,
                  ],
                  [
                    "Ready for native posting",
                    state.targets.filter((t) => t.status === "manual_ready")
                      .length,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <section className="social-card social-intro">
                <div>
                  <p className="eyebrow">YOUR NEXT POST</p>
                  <h2>Start with an original.</h2>
                  <p>
                    Choose a painting, prepare four versions, then review each
                    one. Originals stay unchanged. No ads, unsolicited messages
                    or automatic replies.
                  </p>
                  <button
                    className="button button-dark"
                    onClick={() => {
                      setCompose(true);
                      setTab("content");
                    }}
                  >
                    Create a campaign <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="social-channel-grid">
                  {platforms.map((p) => (
                    <div key={p}>
                      <span className={`social-platform ${p}`}>
                        {p.slice(0, 2).toUpperCase()}
                      </span>
                      <strong>{names[p]}</strong>
                      <small>
                        {p === "tiktok"
                          ? "Native posting package"
                          : state.capabilities[p].connection.state ===
                              "available"
                            ? "Account verified · review permissions"
                            : "Manual export ready · account not connected"}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "content" && (
            <>
              {compose && (
                <CampaignComposer
                  artworks={artworks}
                  busy={busy}
                  save={(input) =>
                    act(async () => {
                      await api("posts", input);
                      setCompose(false);
                    }, "Campaign saved. Review and approve each platform version.")
                  }
                  api={api}
                />
              )}
              {!state.posts.length && !compose && (
                <div className="social-empty">
                  <h2>Your next story starts here.</h2>
                  <p>
                    Create an artwork campaign to prepare versions for all four
                    platforms.
                  </p>
                  <button
                    className="button button-dark"
                    onClick={() => setCompose(true)}
                  >
                    New campaign <Plus size={16} />
                  </button>
                </div>
              )}
              {state.posts.map((p) => (
                <section className="social-campaign" key={p.id}>
                  <header>
                    <div>
                      <p className="eyebrow">
                        {p.intent} / {p.campaign || "ORIGINALS"}
                      </p>
                      <h2>{p.title}</h2>
                    </div>
                    <button
                      className="social-subtle"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () =>
                            api(`posts/${p.id}/archive`, {
                              expectedRevision: p.revision,
                            }),
                          "Campaign archived locally. Remote posts were not deleted.",
                        )
                      }
                    >
                      Archive locally
                    </button>
                  </header>
                  <CampaignDetails
                    key={`${p.id}:${p.revision}`}
                    post={p}
                    targets={state.targets.filter((t) => t.postId === p.id)}
                    artworks={artworks}
                    busy={busy}
                    act={act}
                  />
                  <div className="social-targets">
                    {state.targets
                      .filter((t) => t.postId === p.id)
                      .map((t) => (
                        <TargetEditor
                          key={`${t.id}:${t.revision}`}
                          target={t}
                          state={state}
                          busy={busy}
                          act={act}
                        />
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {tab === "calendar" && (
            <section className="social-card">
              <h2>Your publishing calendar</h2>
              <div className="form-row">
                <label>
                  Week starting · Guatemala time
                  <input
                    type="date"
                    required
                    value={weekStart}
                    onChange={(e) => {
                      if (e.target.value) setWeekStart(e.target.value);
                    }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={weekOnly}
                    onChange={(e) => setWeekOnly(e.target.checked)}
                  />
                  Show this seven-day window
                </label>
              </div>
              <p className="studio-note">
                Times retain their selected timezone. Jobs over one hour late
                are blocked for review. A saved schedule does not mean an
                unattended worker is online.
              </p>
              {state.targets
                .filter(
                  (t) =>
                    t.scheduledAt &&
                    (!weekOnly ||
                      (localValue(t.scheduledAt, "America/Guatemala").slice(
                        0,
                        10,
                      ) >= weekStart &&
                        localValue(t.scheduledAt, "America/Guatemala").slice(
                          0,
                          10,
                        ) <
                          new Date(
                            Date.parse(weekStart + "T00:00:00Z") + 7 * 86400000,
                          )
                            .toISOString()
                            .slice(0, 10))),
                )
                .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
                .map((t) => (
                  <div className="social-calendar-row" key={t.id}>
                    <div>
                      <strong>
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: t.timezone,
                        }).format(new Date(t.scheduledAt!))}
                      </strong>
                      <small>{t.timezone}</small>
                    </div>
                    <span>{names[t.provider]}</span>
                    <span>
                      {state.posts.find((p) => p.id === t.postId)?.title}
                    </span>
                    <span className={`social-badge ${t.status}`}>
                      {labels[t.status]}
                    </span>
                    <button
                      className="social-subtle"
                      onClick={() => setTab("content")}
                    >
                      Review
                    </button>
                  </div>
                ))}
              {!state.targets.some((t) => t.scheduledAt) && (
                <p className="social-empty">
                  No planned posts yet. Set a time in a platform version, save
                  and approve it, then schedule.
                </p>
              )}
            </section>
          )}
          {tab === "media" && (
            <MediaLibrary assets={state.assets} busy={busy} act={act} />
          )}
          {tab === "connections" && (
            <Connections state={state} busy={busy} act={act} />
          )}
          {tab === "analytics" && (
            <section className="social-card">
              <h2>Evidence, not estimates.</h2>
              <p className="studio-note">
                Metrics come only from authorized provider reads. Missing data
                stays unavailable. Manual reports and creator-only tests are not
                verified public posts. No revenue attribution is inferred.
              </p>
              <div className="social-inline-actions">
                {state.connections
                  .filter((c) => c.status === "connected")
                  .map((c) => (
                    <button
                      className="button"
                      disabled={busy}
                      key={c.id}
                      onClick={() =>
                        act(
                          () => api("metrics/sync", { connectionId: c.id }),
                          "Metric sync queued. Run due jobs to fetch authorized reads.",
                        )
                      }
                    >
                      <RefreshCw size={15} />
                      {names[c.provider]} · sync
                    </button>
                  ))}
              </div>
              {state.metrics.map((m, i) => (
                <div className="social-calendar-row" key={String(m.id || i)}>
                  <strong>{String(m.metric_key)}</strong>
                  <span>
                    {m.value === null ? "Not available" : String(m.value)}
                  </span>
                  <small>
                    {String(m.aggregation)} · {String(m.definition_version)}
                  </small>
                  <small>{String(m.collected_at)}</small>
                </div>
              ))}
              {!state.metrics.length && (
                <p className="social-empty">
                  No verified metrics yet. Connect an account and sync supported
                  posts.
                </p>
              )}
            </section>
          )}
          {tab === "activity" && (
            <section className="social-card">
              <h2>Activity & worker health</h2>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  act(
                    async () => setAttempts((await api("jobs")).attempts),
                    "Safe attempt summaries loaded.",
                  )
                }
              >
                Load attempt details
              </button>
              {attempts.map((a, i) => (
                <p className="studio-note" key={String(a.started_at) + i}>
                  {String(a.step_key)} · attempt {String(a.attempt_no)} ·{" "}
                  {String(a.outcome || "unresolved")} ·{" "}
                  {String(a.error_code || "No error recorded")} ·{" "}
                  {String(a.started_at)}
                </p>
              ))}
              {state.health.map((h, i) => (
                <p className="studio-note" key={String(h.worker_id || i)}>
                  {String(h.mode)} · started {String(h.last_started_at)} ·{" "}
                  {h.last_completed_at ? "completed" : "no completion recorded"}{" "}
                  · {String(h.processed_count)} processed
                </p>
              ))}
              {state.jobs.map((j) => (
                <div className="social-calendar-row" key={j.id}>
                  <strong>{j.kind}</strong>
                  <span>{j.state}</span>
                  <span>{j.lastErrorCode || "No error recorded"}</span>
                  <small>
                    Attempt {j.attempts} · {new Date(j.runAt).toLocaleString()}
                  </small>
                </div>
              ))}
              {state.activity.map((a, i) => (
                <p className="studio-note" key={String(a.created_at) + i}>
                  {String(a.action).replaceAll("_", " ")} ·{" "}
                  {String(a.created_at)}
                </p>
              ))}
              {!state.jobs.length && !state.activity.length && (
                <p className="social-empty">
                  No publishing jobs or provider actions yet.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
function CampaignComposer({
  artworks,
  busy,
  save,
  api,
}: {
  artworks: Artwork[];
  busy: boolean;
  save: (v: unknown) => Promise<void>;
  api: (path: string, body?: unknown, method?: string) => Promise<any>;
}) {
  const [title, setTitle] = useState(artworks[0]?.title || "A studio note");
  const [artworkId, setArtworkId] = useState(artworks[0]?.id || ""),
    [intent, setIntent] = useState<Post["intent"]>("availability"),
    [caption, setCaption] = useState(
      artworks[0] ? captionFor(artworks[0], "availability") : "",
    ),
    [selected, setSelected] = useState<Platform[]>([...platforms]),
    [error, setError] = useState(""),
    [preparing, setPreparing] = useState(false),
    [requestId] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPreparing(true);
    try {
      const f = new FormData(e.currentTarget),
        a = artworks.find((a) => a.id === artworkId);
      const asset = a
        ? (await api("assets/artwork", { artworkId: a.id })).asset
        : null;
      if (!selected.length) throw new Error("Choose at least one platform.");
      const title = String(f.get("title"));
      await save({
        requestId,
        title,
        artworkId: artworkId || null,
        intent,
        campaign: String(f.get("campaign") || "originals"),
        targets: selected.map((provider) => ({
          provider,
          deliveryMode: "manual",
          connectionId: null,
          format: provider === "facebook" && !asset ? "text" : "image",
          caption,
          options: {
            ...defaultOptions(provider),
            ...(provider === "pinterest" ? { title: title.slice(0, 100) } : {}),
          },
          assetIds: asset ? [asset.id] : [],
          linkUrl: null,
          scheduledAt: null,
          timezone: "America/Guatemala",
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare draft.");
    } finally {
      setPreparing(false);
    }
  }
  function changeArtwork(id: string) {
    setArtworkId(id);
    const a = artworks.find((a) => a.id === id);
    if (a) {
      setCaption(captionFor(a, intent));
      setTitle(a.title);
    }
  }
  return (
    <form className="social-composer social-card" onSubmit={submit}>
      <p className="eyebrow">NEW CAMPAIGN</p>
      <h2>Let the work speak.</h2>
      <div className="form-row">
        <label>
          Campaign title
          <input
            name="title"
            required
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Campaign tag
          <input
            name="campaign"
            pattern="[A-Za-z0-9-]*"
            maxLength={80}
            defaultValue="originals"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Artwork
          <select
            value={artworkId}
            onChange={(e) => changeArtwork(e.target.value)}
          >
            <option value="">No specific artwork</option>
            {artworks.map((a) => (
              <option value={a.id} key={a.id}>
                {a.title} · {a.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Purpose
          <select
            value={intent}
            onChange={(e) => {
              const v = e.target.value as Post["intent"];
              setIntent(v);
              const a = artworks.find((a) => a.id === artworkId);
              if (a) setCaption(captionFor(a, v));
            }}
          >
            <option value="availability">Available original · inquiry</option>
            <option value="portfolio">Portfolio · include sold label</option>
            <option value="process">Artist & process</option>
            <option value="announcement">Announcement</option>
          </select>
        </label>
      </div>
      <fieldset className="social-platform-picker">
        <legend>Prepare versions for</legend>
        {platforms.map((p) => (
          <label key={p}>
            <input
              type="checkbox"
              checked={selected.includes(p)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, p]
                    : selected.filter((v) => v !== p),
                )
              }
            />
            {names[p]}
          </label>
        ))}
      </fieldset>
      <label>
        Starting caption
        <textarea
          value={caption}
          required
          maxLength={5000}
          onChange={(e) => setCaption(e.target.value)}
          rows={6}
        />
      </label>
      <p className="studio-note">
        Templates use confirmed artwork facts. Purchasing is not claimed live.
        Each platform version can be edited separately after saving.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={busy || preparing}>
        {preparing ? "Verifying media…" : "Save campaign drafts"}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
function TargetEditor({
  target: t,
  state,
  busy,
  act,
}: {
  target: Target;
  state: State;
  busy: boolean;
  act: (f: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(targetInput(t)),
    [schedule, setSchedule] = useState(localValue(t.scheduledAt, t.timezone)),
    [localError, setLocalError] = useState(""),
    [boards, setBoards] = useState<{ id: string; name: string }[]>([]),
    [report, setReport] = useState(false),
    [permalink, setPermalink] = useState("");
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(targetInput(t)) ||
    schedule !== localValue(t.scheduledAt, t.timezone);
  const editable = [
    "draft",
    "approved",
    "scheduled",
    "queued",
    "blocked",
    "failed",
    "retry_wait",
  ].includes(t.status);
  const approved =
    !!t.approvedHash && t.approvedRevision === t.revision && !dirty;
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      setLocalError("");
      const scheduledAt = schedule
        ? localSchedule(schedule, draft.timezone)
        : null;
      await act(
        () =>
          api(
            `targets/${t.id}`,
            { expectedRevision: t.revision, target: { ...draft, scheduledAt } },
            "PATCH",
          ),
        "Version saved. Review and approve this new revision.",
      );
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Choose a valid time.");
    }
  }
  const action = (name: string) =>
    act(
      () => api(`targets/${t.id}/${name}`, { expectedRevision: t.revision }),
      name === "approve"
        ? "Exact revision approved."
        : "Action completed. Review this destination’s status.",
    );
  return (
    <article className="social-target">
      <header>
        <div>
          <span className={`social-platform ${t.provider}`}>
            {t.provider.slice(0, 2).toUpperCase()}
          </span>
          <strong>{names[t.provider]}</strong>
        </div>
        <span className={`social-badge ${t.status}`}>{labels[t.status]}</span>
      </header>
      <form onSubmit={save}>
        <label>
          Caption
          <textarea
            value={draft.caption}
            onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
            disabled={!editable}
            maxLength={
              t.provider === "pinterest"
                ? 800
                : t.provider === "facebook"
                  ? 5000
                  : 2200
            }
            rows={6}
          />
          <small>{draft.caption.length} characters</small>
        </label>
        <div className="form-row">
          <label>
            Format
            <select
              value={draft.format}
              disabled={!editable}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  format: e.target.value as Target["format"],
                })
              }
            >
              <option value="image">Single image</option>
              <option value="carousel">Image carousel</option>
              <option value="video">Original video</option>
              {t.provider === "facebook" && (
                <option value="text">Text / link</option>
              )}
            </select>
          </label>
          <label>
            Delivery
            <select
              value={draft.deliveryMode}
              disabled={!editable}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deliveryMode: e.target.value as Target["deliveryMode"],
                })
              }
            >
              <option value="manual">Native posting package</option>
              {t.provider !== "tiktok" && (
                <option value="api_public">Public API · setup required</option>
              )}
              {t.provider === "pinterest" && (
                <option value="api_test">Trial API · creator only</option>
              )}
            </select>
          </label>
        </div>
        <label>
          Destination account
          <select
            value={draft.connectionId || ""}
            disabled={!editable}
            onChange={(e) =>
              setDraft({ ...draft, connectionId: e.target.value || null })
            }
          >
            <option value="">Native account · choose in app</option>
            {state.connections
              .filter(
                (c) => c.provider === t.provider && c.status === "connected",
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} · {c.externalId}
                </option>
              ))}
          </select>
        </label>
        <fieldset className="social-asset-picker">
          <legend>
            Verified media · selected order (Pinterest video: video first, cover
            second)
          </legend>
          {state.assets.map((a) => (
            <label key={a.id}>
              <input
                type="checkbox"
                disabled={!editable}
                checked={draft.assetIds.includes(a.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    assetIds: e.target.checked
                      ? [...draft.assetIds, a.id]
                      : draft.assetIds.filter((id) => id !== a.id),
                  })
                }
              />
              {a.kind === "image" ? (
                <img src={a.url} alt="Verified original" />
              ) : (
                <span>VIDEO</span>
              )}
              <small>
                {a.width} × {a.height} · {a.mime.split("/")[1]}
                {draft.assetIds.includes(a.id)
                  ? ` · #${draft.assetIds.indexOf(a.id) + 1}`
                  : ""}
              </small>
            </label>
          ))}
        </fieldset>
        {draft.options.provider === "pinterest" && (
          <>
            <label>
              Pin title
              <input
                value={draft.options.title}
                maxLength={100}
                disabled={!editable}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    options: {
                      ...(draft.options as Extract<
                        Target["options"],
                        { provider: "pinterest" }
                      >),
                      title: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              Pin alt text
              <input
                value={draft.options.altText}
                maxLength={500}
                disabled={!editable}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    options: {
                      ...(draft.options as Extract<
                        Target["options"],
                        { provider: "pinterest" }
                      >),
                      altText: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              Board ID · API only
              <input
                value={draft.options.boardId}
                disabled={!editable}
                inputMode="numeric"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    options: {
                      ...(draft.options as Extract<
                        Target["options"],
                        { provider: "pinterest" }
                      >),
                      boardId: e.target.value,
                    },
                  })
                }
              />
            </label>
            {draft.connectionId && (
              <button
                type="button"
                className="social-subtle"
                onClick={() =>
                  act(async () => {
                    const r = await api(
                      `boards?connectionId=${draft.connectionId}`,
                    );
                    setBoards(r.boards);
                  }, "Owned boards loaded.")
                }
              >
                Load owned boards
              </button>
            )}
            {boards.map((b) => (
              <button
                type="button"
                className="social-subtle"
                key={b.id}
                onClick={() =>
                  setDraft({
                    ...draft,
                    options: {
                      ...(draft.options as Extract<
                        Target["options"],
                        { provider: "pinterest" }
                      >),
                      boardId: b.id,
                    },
                  })
                }
              >
                {b.name} · {b.id}
              </button>
            ))}
          </>
        )}
        {draft.options.provider === "instagram" && (
          <label>
            Image alt text
            <input
              maxLength={1000}
              value={draft.options.altText}
              disabled={!editable}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  options: { provider: "instagram", altText: e.target.value },
                })
              }
            />
          </label>
        )}
        <label>
          Verified public artwork URL · optional
          <input
            type="url"
            value={draft.linkUrl || ""}
            disabled={!editable}
            placeholder="Use a public artwork page, not the protected preview"
            onChange={(e) =>
              setDraft({ ...draft, linkUrl: e.target.value || null })
            }
          />
        </label>
        <div className="form-row">
          <label>
            Planned local time
            <input
              type="datetime-local"
              value={schedule}
              disabled={!editable}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </label>
          <label>
            Timezone
            <input
              value={draft.timezone}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            />
          </label>
        </div>
        {localError && (
          <p className="form-error" role="alert">
            {localError}
          </p>
        )}
        {editable && (
          <button className="button" disabled={busy || !dirty}>
            Save version changes
          </button>
        )}
      </form>
      <div className="social-target-actions">
        <button
          disabled={busy || dirty}
          onClick={() =>
            act(async () => {
              const r = await api(`targets/${t.id}/validate`, {});
              if (!r.valid) throw new Error(r.errors.join(" "));
            }, "This version passes local validation.")
          }
        >
          Validate
        </button>
        {["draft", "approved"].includes(t.status) && (
          <button disabled={busy || dirty} onClick={() => action("approve")}>
            <Check size={14} />
            Approve exact version
          </button>
        )}
        {approved && ["approved", "scheduled", "queued"].includes(t.status) && (
          <button
            disabled={busy}
            onClick={() => action(t.scheduledAt ? "schedule" : "publish")}
          >
            {t.scheduledAt
              ? "Queue approved schedule"
              : t.deliveryMode === "manual"
                ? "Prepare manual package"
                : "Queue approved API post"}
          </button>
        )}
        {approved &&
          [
            "approved",
            "manual_ready",
            "manually_reported",
            "scheduled",
            "queued",
          ].includes(t.status) && (
            <a href={`/api/studio/social/targets/${t.id}/export`} download>
              <Download size={14} />
              Download package
            </a>
          )}
        <button
          onClick={() =>
            act(
              () => navigator.clipboard.writeText(draft.caption),
              "Caption copied.",
            )
          }
        >
          <Copy size={14} />
          Copy caption
        </button>
        {["manual_ready", "awaiting_creator"].includes(t.status) && (
          <button disabled={busy} onClick={() => setReport(!report)}>
            Record native post
          </button>
        )}
        {["blocked", "failed"].includes(t.status) && (
          <button disabled={busy} onClick={() => action("reset")}>
            Reset for fresh review
          </button>
        )}
        {t.status === "uncertain" && (
          <button disabled={busy} onClick={() => action("reconcile")}>
            Reconcile read-only
          </button>
        )}
        {t.status === "retry_wait" && (
          <button disabled={busy} onClick={() => action("retry")}>
            Retry safe operation
          </button>
        )}
        {["draft", "approved", "scheduled", "queued", "retry_wait"].includes(
          t.status,
        ) && (
          <button disabled={busy} onClick={() => action("cancel")}>
            Cancel local work
          </button>
        )}
      </div>
      {report && (
        <form
          className="social-report"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () =>
                api(`targets/${t.id}/manual-result`, {
                  expectedRevision: t.revision,
                  permalink: permalink || null,
                }),
              "Recorded as manually reported, not provider-verified.",
            );
            setReport(false);
          }}
        >
          <label>
            Native post link
            <input
              type="url"
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <button className="button" disabled={busy}>
            Confirm I posted this natively
          </button>
        </form>
      )}
      {dirty && (
        <p className="studio-note">
          Unsaved changes · save before validation or approval.
        </p>
      )}
      {t.lastErrorCode && (
        <p className="social-feedback">
          {t.lastErrorCode.replaceAll("_", " ")} · Review the version, account
          and inventory. Uncertain operations cannot be reposted automatically.
        </p>
      )}
      {t.permalink && (
        <a
          className="text-link"
          href={t.permalink}
          target="_blank"
          rel="noreferrer"
        >
          View native post <ArrowUpRight size={14} />
        </a>
      )}
    </article>
  );
}
function MediaLibrary({
  assets,
  busy,
  act,
}: {
  assets: Asset[];
  busy: boolean;
  act: (f: () => Promise<unknown>, s?: string) => Promise<void>;
}) {
  return (
    <section className="social-card">
      <h2>Originals, ready to share.</h2>
      <p className="studio-note">
        Choose artwork media in a campaign, or upload your own source
        image/video. No color enhancement, background repainting or paid AI
        calls are applied. JPEG/PNG/WebP up to 10 MB; MP4/MOV up to 25 MB.
      </p>
      <label className="social-upload">
        Upload original source media
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            act(async () => {
              const signed = await api("assets/sign", {
                kind: file.type.startsWith("video/") ? "video" : "image",
              });
              if (file.size > signed.maxBytes)
                throw new Error(
                  "Choose a smaller source file within the displayed limit.",
                );
              const form = new FormData();
              Object.entries(signed.params).forEach(([k, v]) =>
                form.set(k, String(v)),
              );
              form.set("api_key", signed.apiKey);
              form.set("signature", signed.signature);
              form.set("file", file);
              const r = await fetch(
                `https://api.cloudinary.com/v1_1/${signed.cloud}/${signed.resourceType}/upload`,
                {
                  method: "POST",
                  body: form,
                  signal: AbortSignal.timeout(120000),
                },
              );
              const result = await r.json();
              if (!r.ok)
                throw new Error("Source upload failed. No post was created.");
              await api("assets/complete", {
                assetId: signed.assetId,
                public_id: result.public_id,
                version: result.version,
                signature: result.signature,
              });
            }, "Source bytes and storage metadata verified.");
          }}
        />
      </label>
      <div className="social-media-grid">
        {assets.map((a) => (
          <article key={a.id}>
            {a.kind === "image" ? (
              <img src={a.url} alt="Original artwork media" />
            ) : (
              <video controls preload="metadata" src={a.url} />
            )}
            <div>
              <strong>
                {a.width} × {a.height}
              </strong>
              <small>
                {a.mime} · {(a.bytes / 1024 / 1024).toFixed(2)} MB
              </small>
              <small>
                {a.apiReady ? "Public source verified" : "Manual download only"}{" "}
                · {a.sha256.slice(0, 12)}
              </small>
              <a
                className="text-link"
                href={`/api/studio/social/assets/${a.id}/download`}
                download
              >
                Download original <Download size={14} />
              </a>
            </div>
          </article>
        ))}
      </div>
      {!assets.length && (
        <p className="social-empty">
          No verified media yet. Start a campaign with an artwork or upload your
          original file.
        </p>
      )}
    </section>
  );
}
function Connections({
  state,
  busy,
  act,
}: {
  state: State;
  busy: boolean;
  act: (f: () => Promise<unknown>, s?: string) => Promise<void>;
}) {
  const [recent, setRecent] = useState<{ id: string; caption: string }[]>([]);
  const setup: Record<Platform, string> = {
    instagram: "https://developers.facebook.com/apps/",
    facebook: "https://developers.facebook.com/apps/",
    pinterest: "https://developers.pinterest.com/apps/",
    tiktok: "https://developers.tiktok.com/",
  };
  return (
    <>
      <div className="social-connection-grid">
        {platforms.map((p) => (
          <section className="social-card" key={p}>
            <span className={`social-platform ${p}`}>
              {p.slice(0, 2).toUpperCase()}
            </span>
            <h2>{names[p]}</h2>
            <p className="studio-note">
              {p === "instagram"
                ? "Primary account: @larkova.art. Professional account required; Instagram Login is separate from Facebook Login."
                : p === "facebook"
                  ? "Connect with Facebook Login, then choose the exact managed Page. Personal profiles are not publishing destinations."
                  : p === "pinterest"
                    ? "Connect your business app and select an owned board. Trial Pins are creator-only; public Pins require Standard access."
                    : "Native posting packages are available now. Direct Post is policy-restricted for private account-management tools."}
            </p>
            <p className="social-feedback">
              {state.capabilities[p].connection.ownerAction ||
                "Identity read verified. Publishing permissions and exact-post approval are checked separately."}
            </p>
            <button
              className="button button-dark"
              disabled={
                busy || !state.config.providers[p].configured || p === "tiktok"
              }
              onClick={() =>
                act(async () => {
                  const r = await api(`connections/${p}/start`, {});
                  window.location.assign(r.url);
                }, "Opening the platform’s authorization screen.")
              }
            >
              Connect {names[p]} <ArrowUpRight size={15} />
            </button>
            <a
              className="text-link"
              href={setup[p]}
              target="_blank"
              rel="noreferrer"
            >
              Developer app setup <ArrowUpRight size={14} />
            </a>
            <p className="fine-print">
              Callback:{" "}
              {state.config.origin
                ? `${state.config.origin}/api/social/oauth/${p}/callback`
                : "Set SOCIAL_ORIGIN first"}
            </p>
            {p !== "tiktok" && !state.config.providers[p].configured && (
              <p className="fine-print">
                Setup variables: SOCIAL_{p.toUpperCase()}_CLIENT_ID, SOCIAL_
                {p.toUpperCase()}_CLIENT_SECRET, SOCIAL_ORIGIN and
                SOCIAL_TOKEN_KEY_V1. Save secrets only in Vercel environment
                settings.
              </p>
            )}
            {state.connections
              .filter((c) => c.provider === p)
              .map((c) => (
                <div className="social-identity" key={c.id}>
                  <strong>{c.displayName}</strong>
                  <p>
                    {c.username ? `@${c.username} · ` : ""}Account ID{" "}
                    {c.externalId}
                  </p>
                  <p>
                    {c.status} ·{" "}
                    {c.metadata.selected
                      ? "identity confirmed"
                      : "confirmation required"}
                  </p>
                  <small>
                    Granted:{" "}
                    {c.scopes.join(", ") || "No granted scope evidence"}
                  </small>
                  {!c.metadata.selected && c.status === "connected" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () =>
                            api("connections/select", {
                              connectionId: c.id,
                              externalId: c.externalId,
                            }),
                          "Exact account confirmed. Review publishing capabilities separately.",
                        )
                      }
                    >
                      Use this exact account
                    </button>
                  )}
                  {c.provider === "pinterest" && c.status === "connected" && (
                    <label>
                      Actual app tier · confirm from developer dashboard
                      <select
                        value={c.metadata.accessTier || "unknown"}
                        onChange={(e) => {
                          if (e.target.value !== "unknown")
                            act(
                              () =>
                                api("connections/select", {
                                  connectionId: c.id,
                                  externalId: c.externalId,
                                  accessTier: e.target.value,
                                }),
                              "Owner-confirmed app tier recorded; it is not a public-post verification.",
                            );
                        }}
                      >
                        <option value="unknown">
                          Unknown · public API blocked
                        </option>
                        <option value="trial">
                          Trial · creator-only tests
                        </option>
                        <option value="standard">
                          Standard · app review approved
                        </option>
                      </select>
                    </label>
                  )}
                  <div className="social-inline-actions">
                    <button
                      disabled={busy || c.status !== "connected"}
                      onClick={() =>
                        act(
                          () => api(`connections/${c.id}/verify`, {}),
                          "Account identity verified read-only.",
                        )
                      }
                    >
                      Verify identity
                    </button>
                    <button
                      disabled={busy || c.status !== "connected"}
                      onClick={() =>
                        act(async () => {
                          const r = await api(`connections/${c.id}/media`);
                          setRecent(r.media);
                        }, "Recent account media read; no publication was requested.")
                      }
                    >
                      Read recent media
                    </button>
                    <button
                      disabled={busy || c.status === "disconnected"}
                      onClick={() =>
                        act(
                          () => api(`connections/${c.id}/disconnect`, {}),
                          "Disconnected locally. Remove the app in native platform settings to revoke provider access too.",
                        )
                      }
                    >
                      Disconnect locally
                    </button>
                  </div>
                </div>
              ))}
          </section>
        ))}
      </div>
      {recent.length > 0 && (
        <section className="social-card">
          <h2>Recent account media · read only</h2>
          {recent.map((item) => (
            <p className="studio-note" key={item.id}>
              <strong>{item.id}</strong> · {item.caption}
            </p>
          ))}
        </section>
      )}
      {state.candidates.length > 0 && (
        <section className="social-card">
          <h2>Choose your Facebook Page</h2>
          {state.candidates.map((c) => (
            <div className="social-calendar-row" key={c.id}>
              <strong>{c.displayName || "Managed Page"}</strong>
              <span>{c.external_resource_id}</span>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  act(
                    () => api("connections/select", { candidateId: c.id }),
                    "Page credential saved privately. Confirm its exact identity below.",
                  )
                }
              >
                Choose this Page
              </button>
            </div>
          ))}
        </section>
      )}
      <section className="social-card">
        <h2>Before public posting</h2>
        <p className="studio-note">
          Your app accounts, scopes and public privacy/callback URLs need
          platform approval. Public writing stays off in previews. No account
          password or access token belongs in this form or chat. The manual
          workflow remains available without these integrations.
        </p>
        <Link className="text-link" href="/social/privacy">
          Social data & privacy <ArrowUpRight size={14} />
        </Link>
      </section>
    </>
  );
}

function CampaignDetails({
  post,
  targets,
  artworks,
  busy,
  act,
}: {
  post: Post;
  targets: Target[];
  artworks: Artwork[];
  busy: boolean;
  act: (f: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(post.title),
    [campaign, setCampaign] = useState(post.campaign),
    [intent, setIntent] = useState(post.intent),
    [artworkId, setArtworkId] = useState(post.artworkId || "");
  return (
    <div className="social-card">
      <button
        className="social-subtle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Campaign details & destinations
      </button>
      {open && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () =>
                  api(
                    `posts/${post.id}`,
                    {
                      expectedRevision: post.revision,
                      title,
                      campaign,
                      intent,
                      artworkId: artworkId || null,
                    },
                    "PATCH",
                  ),
                "Campaign details saved. Changed artwork or purpose requires fresh destination approval.",
              );
            }}
          >
            <div className="form-row">
              <label>
                Campaign name
                <input
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Campaign tag
                <input
                  pattern="[A-Za-z0-9-]*"
                  maxLength={80}
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Campaign artwork
                <select
                  value={artworkId}
                  onChange={(e) => setArtworkId(e.target.value)}
                >
                  <option value="">No specific artwork</option>
                  {artworks.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Campaign purpose
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as Post["intent"])}
                >
                  {["availability", "portfolio", "process", "announcement"].map(
                    (v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <button className="button" disabled={busy}>
              Save campaign details
            </button>
          </form>
          <div className="social-inline-actions">
            {platforms
              .filter(
                (provider) => !targets.some((t) => t.provider === provider),
              )
              .map((provider) => (
                <button
                  className="button"
                  disabled={busy}
                  key={provider}
                  onClick={() =>
                    act(
                      () =>
                        api(`posts/${post.id}/targets`, {
                          expectedRevision: post.revision,
                          target: {
                            provider,
                            deliveryMode: "manual",
                            connectionId: null,
                            format: targets[0]?.format || "image",
                            caption: targets[0]?.caption || "",
                            assetIds: targets[0]?.assetIds || [],
                            options: {
                              ...defaultOptions(provider),
                              ...(provider === "pinterest"
                                ? { title: post.title.slice(0, 100) }
                                : {}),
                            },
                            linkUrl: null,
                            scheduledAt: null,
                            timezone: "America/Guatemala",
                          },
                        }),
                      "Destination added as a draft. Review its format and content.",
                    )
                  }
                >
                  Add {names[provider]}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
