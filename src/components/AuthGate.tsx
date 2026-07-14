"use client";

import { useEffect, useState } from "react";

// Soft login gate. The site is static, so this deters casual visitors rather
// than providing real security — the password is stored only as a SHA-256 hash,
// never in plain text. For true protection, put the site behind Cloudflare
// Access or a host that supports HTTP auth.
const PASS_HASH = "cee70e24bbb5807bf68aebdbd901699cdad18e6d192703dc7a444f9e1e12d316";
const STORE_KEY = "edge-gate-ok";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORE_KEY) === "1") setOk(true);
    } catch {}
    setReady(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hex = await sha256Hex(pass);
    if (hex === PASS_HASH && user.trim().length > 0) {
      try {
        localStorage.setItem(STORE_KEY, "1");
      } catch {}
      setOk(true);
    } else {
      setError(true);
    }
  };

  if (ok) return <>{children}</>;

  // Until unlocked, cover everything with the login panel.
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-plane px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-md text-good-ink"
            style={{ background: "var(--color-brand)" }}
            aria-hidden
          >
            ⚽
          </span>
          <span className="text-[15px] font-semibold">
            Edge<span className="text-muted"> · football</span>
          </span>
        </div>
        <p className="mb-4 text-sm text-muted">Enter your details to continue.</p>

        <label className="mb-1 block text-[11px] tracked text-muted">User</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          className="mb-3 w-full rounded-md border border-line-2 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />

        <label className="mb-1 block text-[11px] tracked text-muted">Password</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => {
            setPass(e.target.value);
            setError(false);
          }}
          autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-line-2 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />

        {error && <p className="mb-3 text-xs text-crit">Wrong user or password.</p>}

        <button
          type="submit"
          disabled={!ready}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-good-ink hover:opacity-90"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
