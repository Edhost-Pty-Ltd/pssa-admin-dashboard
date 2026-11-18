import { Link } from "react-router-dom";

/**
 * Brand wordmark matching the PSSA landing page.
 * Swap this single component when final emblem artwork is approved.
 */
export function Wordmark({
  tone = "light",
  to = "/admin",
  compact = false,
}: {
  tone?: "light" | "dark";
  to?: string;
  compact?: boolean;
}) {
  const main = tone === "light" ? "text-white" : "text-navy";
  const sub = tone === "light" ? "text-white/60" : "text-muted";
  return (
    <Link to={to} className="group flex flex-col leading-none" aria-label="PSSA Admin home">
      <span className={`font-display ${compact ? "text-[24px]" : "text-[28px]"} font-bold tracking-tight ${main}`}>
        PSSA<span className="text-green">.</span>
      </span>
      <span className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${sub}`}>
        Personal Shoppers &amp; Sourcing Association
      </span>
    </Link>
  );
}
