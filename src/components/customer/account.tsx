"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { customerCopy } from "@/lib/customer/copy";
import { useCustomer } from "./provider";
class AuthFailure extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
async function auth(path: string, body: unknown) {
  const r = await fetch("/api/auth/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new AuthFailure(data.code || "UNKNOWN");
  return data;
}
export function CustomerAccount({ locale }: { locale: Locale }) {
  const c = useCustomer(),
    t = customerCopy[locale];
  const [mode, setMode] = useState<
      "signin" | "signup" | "verify" | "forgot" | "reset" | "twofactor"
    >("signin"),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [securityPassword, setSecurityPassword] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("error"))
      setMessage(t.googleConflict);
  }, [t.googleConflict]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      if (e instanceof AuthFailure && e.code === "EMAIL_NOT_VERIFIED") {
        setMode("verify");
        await auth("email-otp/send-verification-otp", {
          email,
          type: "email-verification",
        }).catch(() => {});
        setMessage(t.verifyNote);
      } else setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (mode === "signup") {
        await auth("sign-up/email", { email, password, name });
        setPassword("");
        setMode("verify");
        setMessage(t.verifyNote);
      } else if (mode === "signin") {
        const result = await auth("sign-in/email", {
          email,
          password,
          rememberMe: true,
        });
        setPassword("");
        if (result.twoFactorRedirect) {
          setMode("twofactor");
          await auth("two-factor/send-otp", { trustDevice: false });
          setMessage(t.otpChallenge);
        } else await c.reload();
      } else if (mode === "verify") {
        await auth("email-otp/verify-email", { email, otp: code });
        setCode("");
        setMode("signin");
        setMessage(t.verified);
      } else if (mode === "forgot") {
        await auth("email-otp/request-password-reset", { email });
        setMode("reset");
        setMessage(t.sent);
      } else if (mode === "reset") {
        await auth("email-otp/reset-password", { email, otp: code, password });
        setCode("");
        setPassword("");
        setMode("signin");
        setMessage(t.resetDone);
      } else {
        await auth("two-factor/verify-otp", { code, trustDevice: false });
        setCode("");
        await c.reload();
        setMode("signin");
      }
    });
  }
  async function google(link = false) {
    await run(async () => {
      const next = await auth(link ? "link-social" : "sign-in/social", {
        provider: "google",
        callbackURL: `/${locale}/account`,
        errorCallbackURL: `/${locale}/account?error=google`,
      });
      if (next.url) location.assign(next.url);
      else throw new Error();
    });
  }
  const user = c.state.user;
  return (
    <section className="section-wrap customer-account">
      <p className="eyebrow">LARKOVA / {t.account}</p>
      <h1>{user ? user.name : t.account}</h1>
      {message && (
        <p
          className="customer-feedback"
          role="alert"
          tabIndex={-1}
          ref={feedback}
        >
          {message}
        </p>
      )}
      {user ? (
        <>
          <div className="account-overview">
            <div>
              <Mail size={22} />
              <p>{user.email}</p>
              <span>{user.emailVerified ? t.verifiedLabel : t.verifyNote}</span>
            </div>
            <Link href={`/${locale}/favorites`}>
              {t.favorites}
              <strong>{c.favorites.length}</strong>
              <ArrowUpRight size={20} />
            </Link>
            <Link href={`/${locale}/cart`}>
              {t.cart}
              <strong>{c.cart.length}</strong>
              <ArrowUpRight size={20} />
            </Link>
          </div>
          <section className="account-security">
            <ShieldCheck size={24} />
            <h2>{t.security}</h2>
            <p>{user.twoFactorEnabled ? t.otpOn : t.otpOff}</p>
            {user.providers.includes("credential") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await auth(
                      user.twoFactorEnabled
                        ? "two-factor/disable"
                        : "two-factor/enable",
                      {
                        password: securityPassword,
                        ...(!user.twoFactorEnabled ? { method: "otp" } : {}),
                      },
                    );
                    setSecurityPassword("");
                    await c.reload();
                    setMessage(t.securitySaved);
                  });
                }}
              >
                <label>
                  {t.confirmPassword}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={securityPassword}
                    onChange={(e) => setSecurityPassword(e.target.value)}
                    required
                  />
                </label>
                <button
                  className="button button-dark"
                  disabled={busy || !c.state.config.email}
                >
                  {user.twoFactorEnabled ? t.disable : t.enable}
                </button>
              </form>
            )}
            <p className="fine-print">{t.accountHelp}</p>
            {c.state.config.google && !user.providers.includes("google") && (
              <button
                className="button"
                disabled={busy}
                onClick={() => google(true)}
              >
                {t.googleLink}
              </button>
            )}
          </section>
          <button
            className="text-link"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await auth("sign-out", {});
                await c.reload();
                setPassword("");
                setSecurityPassword("");
              })
            }
          >
            {t.signOut}
          </button>
        </>
      ) : (
        <div className="account-entry">
          <div className="account-intro">
            <h2>{t.empty}</h2>
            <p>{t.sync}</p>
            <Link className="text-link" href={`/${locale}#collection`}>
              {t.browse}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="account-form">
            <button
              className="button google-signin"
              disabled={busy || !c.state.config.google}
              onClick={() => google()}
            >
              <span aria-hidden="true">G</span>
              {t.google}
            </button>
            {!c.state.config.google && (
              <p className="fine-print">{t.unavailable}</p>
            )}
            <div className="account-tabs">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  disabled={busy}
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setMessage("");
                    setCode("");
                    setPassword("");
                  }}
                >
                  {m === "signin" ? t.signIn : t.signUp}
                </button>
              ))}
            </div>
            <form onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  {t.name}
                  <input
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              {mode !== "twofactor" && (
                <label>
                  {t.email}
                  <input
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {["signin", "signup", "reset"].includes(mode) && (
                <label>
                  {mode === "reset" ? t.newPassword : t.password}
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {["verify", "reset", "twofactor"].includes(mode) && (
                <label>
                  {t.code}
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
              <p className="fine-print">
                {["verify", "twofactor"].includes(mode)
                  ? t.verifyNote
                  : t.passwordNote}
              </p>
              <button
                className="button button-dark full-width"
                disabled={busy || !c.state.config.email}
              >
                {busy
                  ? t.busy
                  : mode === "signup"
                    ? t.signUp
                    : mode === "signin"
                      ? t.signIn
                      : mode === "forgot" || mode === "reset"
                        ? t.reset
                        : t.verify}
                <ArrowUpRight size={18} />
              </button>
              {!c.state.config.email && (
                <p className="fine-print">{t.unavailable}</p>
              )}
            </form>
            {mode === "signin" && (
              <button
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setMode("forgot");
                  setPassword("");
                }}
              >
                {t.forgot}
              </button>
            )}
            {["verify", "twofactor", "reset"].includes(mode) && (
              <button
                className="text-link"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (mode === "twofactor")
                      await auth("two-factor/send-otp", { trustDevice: false });
                    else if (mode === "reset")
                      await auth("email-otp/request-password-reset", { email });
                    else
                      await auth("email-otp/send-verification-otp", {
                        email,
                        type: "email-verification",
                      });
                    setMessage(t.sent);
                  })
                }
              >
                {t.resend}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
