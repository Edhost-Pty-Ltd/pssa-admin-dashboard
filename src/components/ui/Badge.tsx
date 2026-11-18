import type { ReactNode } from "react";

type Tone = "green" | "navy" | "amber" | "red" | "blue" | "muted";

const TONES: Record<Tone, string> = {
  green: "bg-green-soft text-green-dark border-green/20",
  navy: "bg-navy text-white border-navy",
  amber: "bg-[#fff5df] text-[#8a5a00] border-[#f2d492]",
  red: "bg-[#fff0ef] text-[#b42318] border-[#f9c8c4]",
  blue: "bg-[#eaf3fb] text-navy-2 border-[#c6dff3]",
  muted: "bg-soft text-muted border-line",
};

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" aria-hidden="true" />
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "APPROVED":
    case "ACTIVE":
    case "COMPLETED":
    case "RESOLVED":
    case "DELIVERED":
    case "FOUNDING":
    case "VERIFIED":
      return "green";
    case "UNDER_REVIEW":
    case "IN_PROGRESS":
    case "INVESTIGATING":
    case "REQUESTED":
      return "blue";
    case "PENDING":
    case "INFO_REQUESTED":
    case "INFO_REQUIRED":
    case "CHANGES_REQUESTED":
    case "IN_PROGRESS":
    case "PROBATION":
    case "PAUSED":
    case "ASSOCIATE":
    case "MEDIUM":
      return "amber";
    case "REJECTED":
    case "SUSPENDED":
    case "FLAGGED":
    case "DISPUTED":
    case "ESCALATED":
    case "OPEN":
    case "HIGH":
      return "red";
    case "INCOMPLETE":
    case "NOT_STARTED":
      return "muted";
    default:
      return "muted";
  }
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 border-b border-navy/10 pb-6 sm:flex-row sm:items-end">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green-soft/80 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-green-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
          {kicker}
        </span>
        <h1 className="mt-2.5 font-display text-2xl font-semibold tracking-tight text-navy sm:text-[32px] sm:leading-[1.15]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
