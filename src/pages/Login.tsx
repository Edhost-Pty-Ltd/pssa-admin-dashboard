import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Wordmark";
import { api, errorMessage } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@pssa.org.za");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ user: { id: string; email: string; role: string } }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if (res.user.role !== "ADMIN") {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        setError("This account does not have PSSA Admin access.");
        return;
      }
      navigate("/admin");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 py-12">
      <img
        src="/images/forest-river-bg.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-28 mix-blend-luminosity"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy/92 via-navy/82 to-navy-2/90"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-32 right-[-10%] h-[460px] w-[460px] rounded-full opacity-35 blur-3xl"
        style={{ background: "radial-gradient(circle, #18a269 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 left-[-8%] h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #efe6d4 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="admin-ambient-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />

      <div className="relative z-10 mb-8">
        <Wordmark tone="light" to="/admin" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/20 bg-white/92 p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green-soft px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-green-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          Compliance &amp; Concierge Portal
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy">Admin Sign In</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Sign in with your PSSA Admin account to manage verifications, tutorials, assessments, and safety cases.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-[#f9c8c4] bg-[#fff0ef] px-3.5 py-2.5 text-xs font-medium text-[#b42318]">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink transition focus:border-green focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink transition focus:border-green focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-green py-3 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(24,162,105,0.65)] transition hover:-translate-y-0.5 hover:bg-green-dark disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign In to Dashboard"}
        </button>
      </form>
    </div>
  );
}
