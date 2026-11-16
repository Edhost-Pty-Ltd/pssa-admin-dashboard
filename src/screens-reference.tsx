// Reference: every screen from the Figma design in one file, opened on the admin area.
// Move each admin screen into src/pages/... as it is built properly, then delete this file.
import { useState } from "react";

type IconName =
  | "arrow"
  | "badge"
  | "bank"
  | "book"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "copy"
  | "download"
  | "eye"
  | "file"
  | "flag"
  | "home"
  | "lock"
  | "mail"
  | "menu"
  | "people"
  | "play"
  | "search"
  | "shield"
  | "upload"
  | "user"
  | "warning";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    badge: (
      <>
        <path d="m12 2 2.2 2.3 3.2-.2.7 3.1 2.7 1.7-1.4 2.9 1.4 2.9-2.7 1.7-.7 3.1-3.2-.2L12 22l-2.2-2.3-3.2.2-.7-3.1-2.7-1.7 1.4-2.9-1.4-2.9 2.7-1.7.7-3.1 3.2.2Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    bank: (
      <>
        <path d="m3 10 9-6 9 6" />
        <path d="M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z" />
        <path d="M8 7h8m-8 4h6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6Z" />
        <path d="M14 2v5h5M9 13h6m-6 4h6" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3" />
        <path d="M5 4h12l-2 4 2 4H5" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v1" />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m10 8 6 4-6 4Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2 20 5v6c0 5.2-3.3 9.2-8 11-4.7-1.8-8-5.8-8-11V5Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5" />
        <path d="M4 20h16" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5m0 3h.01" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

type PublicPage = "home" | "register" | "profile" | "complaint" | "complaint-confirm" | "order";
type MemberPage =
  | "dashboard"
  | "verification"
  | "tutorials"
  | "exam"
  | "results"
  | "certificate"
  | "login";
type AdminPage = "applications" | "review" | "cases" | "case-detail" | "members";
type Area = "public" | "member" | "admin";

const members = [
  {
    name: "Lerato Mokoena",
    trading: "Lerato Finds",
    no: "EC-2026-004821",
    scope: ["Fashion", "Beauty"],
    status: "Active",
    until: "28 Feb 2027",
    city: "Johannesburg",
    channels: ["Instagram", "WhatsApp Business"],
  },
  {
    name: "Thabo Ndlovu",
    trading: "Source SA Tech",
    no: "EC-2025-003117",
    scope: ["Electronics", "Collectibles"],
    status: "Suspended",
    until: "14 Sep 2026",
    city: "Cape Town",
    channels: ["Instagram", "Website"],
  },
  {
    name: "Naledi Jacobs",
    trading: "The Edit by Naledi",
    no: "EC-2025-002904",
    scope: ["Fashion", "Homeware"],
    status: "Expired",
    until: "31 Jan 2026",
    city: "Durban",
    channels: ["TikTok", "WhatsApp Business"],
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <button
      className="logo"
      onClick={() => {
        window.scrollTo(0, 0);
      }}
    >
      <span className="logo-mark">
        <Icon name="shield" size={compact ? 22 : 25} />
      </span>
      {!compact && (
        <span>
          <b>PSSA</b>
          <small>Trust in every transaction</small>
        </span>
      )}
    </button>
  );
}

function Status({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "grey" | "blue";
}) {
  return (
    <span className={`status status-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}

function PublicHeader({
  setArea,
  setPage,
}: {
  setArea: (a: Area) => void;
  setPage: (p: PublicPage) => void;
}) {
  const [open, setOpen] = useState(false);
  const go = (page: PublicPage) => {
    setPage(page);
    setOpen(false);
    window.scrollTo(0, 0);
  };
  return (
    <header className="public-header">
      <div className="container nav-inner">
        <Logo />
        <nav className={open ? "nav-links nav-open" : "nav-links"}>
          <button onClick={() => go("register")}>Member register</button>
          <button onClick={() => go("order")}>Order template</button>
          <button onClick={() => go("complaint")}>Raise a concern</button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setArea("member");
              setOpen(false);
            }}
          >
            Member login
          </button>
          <button
            className="btn btn-dark"
            onClick={() => {
              setArea("member");
              setPage("home");
              setOpen(false);
            }}
          >
            Apply to join <Icon name="arrow" size={16} />
          </button>
        </nav>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}

function Footer({ setPage }: { setPage: (p: PublicPage) => void }) {
  return (
    <footer>
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="muted footer-copy">
            Building trust between South African customers and professional personal shoppers.
          </p>
        </div>
        <div>
          <b>For customers</b>
          <button onClick={() => setPage("register")}>Verify a member</button>
          <button onClick={() => setPage("complaint")}>Report a concern</button>
          <button onClick={() => setPage("order")}>Order template</button>
        </div>
        <div>
          <b>Standards</b>
          <button>Code of Conduct</button>
          <button>Complaints & Appeals</button>
          <button>Badge Rules</button>
          <button>Privacy Policy</button>
        </div>
        <div>
          <b>Contact</b>
          <a href="mailto:hello@pssa.site">hello@pssa.site</a>
          <span>South Africa</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Personal Shoppers and Sourcing Association</span>
        <span>
          PSSA certification is privately issued, not a government licence or a guarantee of a
          purchase.
        </span>
      </div>
    </footer>
  );
}

function Home({ setPage }: { setPage: (p: PublicPage) => void }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <section className="hero">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="container hero-content">
          <div className="eyebrow">
            <Icon name="shield" size={15} /> South Africa’s independent verification standard
          </div>
          <h1>
            Shop with verified
            <br />
            <em>personal shoppers.</em>
          </h1>
          <p className="hero-lead">
            Check who you’re buying from before you pay. PSSA verifies identity, trading channels
            and conduct knowledge.
          </p>
          <div className="verify-box">
            <label>Verify a member</label>
            <div className="search-row">
              <Icon name="search" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, member or certificate number"
              />
              <button className="btn btn-green" onClick={() => setPage("register")}>
                Check register <Icon name="arrow" size={17} />
              </button>
            </div>
            <small>
              <Icon name="lock" size={13} /> Only professional details are displayed. No ID
              documents or private addresses.
            </small>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack">
              <span>LM</span>
              <span>TN</span>
              <span>NJ</span>
            </div>
            <p>
              <b>Verified professionals</b>
              <br />
              across South Africa
            </p>
            <div className="proof-divider" />
            <p>
              <b>Live status checks</b>
              <br />
              not static screenshots
            </p>
          </div>
        </div>
      </section>

      <section className="how-section container">
        <div className="section-heading">
          <div>
            <span className="kicker">A clearer standard</span>
            <h2>How PSSA works</h2>
          </div>
          <p>
            We set a practical baseline for identity, professional conduct and customer
            transparency.
          </p>
        </div>
        <div className="step-grid">
          {[
            [
              "01",
              "Verify",
              "We check identity, address or registration, receiving bank account, and controlled sales channels.",
              "shield",
            ],
            [
              "02",
              "Assess",
              "Applicants complete conduct tutorials and pass an entrance assessment on fair trading.",
              "book",
            ],
            [
              "03",
              "Certify",
              "Approved members receive a time-limited certificate linked to a live public profile.",
              "badge",
            ],
          ].map(([no, title, text, icon]) => (
            <article className="step-card" key={title}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon name={icon as IconName} />
                </span>
                <span>{no}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="step-line" />
            </article>
          ))}
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-grid">
          <div>
            <span className="stat">12</span>
            <p>month certification cycle</p>
          </div>
          <div>
            <span className="stat">4</span>
            <p>core verification checks</p>
          </div>
          <div>
            <span className="stat">Free</span>
            <p>to check or raise a complaint</p>
          </div>
          <div>
            <span className="stat">Live</span>
            <p>member status and validity</p>
          </div>
        </div>
      </section>

      <section className="container protection-section">
        <div className="protection-copy">
          <span className="kicker">Before you pay</span>
          <h2>A badge is only the beginning.</h2>
          <p>
            Always click through to the member’s live PSSA profile. It confirms whether their
            certification is active and which channels and services have been verified.
          </p>
          <ul>
            <li>
              <Icon name="check" /> Match the account you’re speaking to
            </li>
            <li>
              <Icon name="check" /> Confirm their approved sourcing scope
            </li>
            <li>
              <Icon name="check" /> Use a clear written order
            </li>
          </ul>
          <button className="text-link" onClick={() => setPage("order")}>
            Get the free order template <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="mini-profile">
          <div className="mini-profile-head">
            <span className="profile-avatar">LM</span>
            <div>
              <Status>Active</Status>
              <h3>Lerato Mokoena</h3>
              <p>Lerato Finds</p>
            </div>
            <Icon name="badge" size={42} />
          </div>
          <div className="mini-detail">
            <span>Certificate</span>
            <b>EC-2026-004821</b>
          </div>
          <div className="mini-detail">
            <span>Valid until</span>
            <b>28 February 2027</b>
          </div>
          <div className="mini-detail">
            <span>Approved scope</span>
            <b>Fashion · Beauty</b>
          </div>
          <button className="btn btn-dark btn-full" onClick={() => setPage("profile")}>
            View live verification <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>

      <section className="container concern-card">
        <div className="concern-icon">
          <Icon name="flag" />
        </div>
        <div>
          <span className="kicker">Something not right?</span>
          <h2>Report a concern. It’s free.</h2>
          <p>
            Tell us about misconduct, impersonation, or misuse of a PSSA badge. Every complete
            report receives a reference number and a fair review.
          </p>
        </div>
        <button className="btn btn-light" onClick={() => setPage("complaint")}>
          Start a report <Icon name="arrow" size={17} />
        </button>
      </section>
    </>
  );
}

function Register({ setPage }: { setPage: (p: PublicPage) => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"results" | "empty" | "loading" | "error">("results");
  const doSearch = () => {
    if (query.toLowerCase().includes("error")) setState("error");
    else if (query && !query.toLowerCase().includes("lerato")) setState("empty");
    else {
      setState("loading");
      setTimeout(() => setState("results"), 700);
    }
  };
  return (
    <main className="page-bg">
      <section className="page-hero">
        <div className="container narrow">
          <span className="kicker light">Public member register</span>
          <h1>Check a member’s current status</h1>
          <p>
            Search the live register before you transact. Use the name, PSSA member number, or
            certificate number shared with you.
          </p>
          <div className="register-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Try “Lerato” or “EC-2026-004821”"
            />
            <button className="btn btn-green" onClick={doSearch}>
              Search register
            </button>
          </div>
        </div>
      </section>
      <section className="container register-body">
        <div className="results-bar">
          <div>
            <h2>{state === "results" ? "3 members found" : "Search results"}</h2>
            <p>Showing live certification status</p>
          </div>
          <div className="state-switch">
            <button onClick={() => setState("results")}>Results</button>
            <button onClick={() => setState("empty")}>Empty</button>
            <button onClick={() => setState("loading")}>Loading</button>
            <button onClick={() => setState("error")}>Error</button>
          </div>
        </div>
        {state === "loading" && (
          <div className="member-list">
            {[1, 2, 3].map((i) => (
              <div className="member-card skeleton" key={i}>
                <div className="sk sk-avatar" />
                <div className="sk-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            ))}
          </div>
        )}
        {state === "empty" && (
          <EmptyState
            icon="search"
            title="No matching members found"
            text="Check the spelling or try a certificate number. If someone is claiming PSSA status but does not appear here, report it to us."
            action="Report possible impersonation"
            onClick={() => setPage("complaint")}
          />
        )}
        {state === "error" && (
          <EmptyState
            icon="warning"
            title="We couldn’t load the register"
            text="There was a problem connecting to the live register. Please try again in a moment."
            action="Try again"
            onClick={() => doSearch()}
            error
          />
        )}
        {state === "results" && (
          <div className="member-list">
            {members.map((m, i) => (
              <article className="member-card" key={m.no}>
                <div className="member-main">
                  <span className="member-avatar">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div>
                    <div className="member-title-row">
                      <h3>{m.name}</h3>
                      <Status
                        tone={
                          m.status === "Active"
                            ? "green"
                            : m.status === "Suspended"
                              ? "red"
                              : "grey"
                        }
                      >
                        {m.status}
                      </Status>
                    </div>
                    <p>
                      {m.trading} · {m.city}
                    </p>
                    <div className="scope-list">
                      {m.scope.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="member-meta">
                  <div>
                    <span>Certificate</span>
                    <b>{m.no}</b>
                  </div>
                  <div>
                    <span>Valid until</span>
                    <b>{m.until}</b>
                  </div>
                  <div>
                    <span>Verified channels</span>
                    <b>{m.channels.join(" · ")}</b>
                  </div>
                </div>
                <button
                  className="round-action"
                  onClick={() => i === 0 && setPage("profile")}
                  aria-label="View profile"
                >
                  <Icon name="arrow" />
                </button>
              </article>
            ))}
          </div>
        )}
        <div className="privacy-note">
          <Icon name="lock" />
          <div>
            <b>Professional information only</b>
            <p>
              PSSA never publishes identity documents, bank evidence, private home addresses, or
              other verification materials.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onClick,
  error,
}: {
  icon: IconName;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
  error?: boolean;
}) {
  return (
    <div className={`empty-state ${error ? "error-state" : ""}`}>
      <span>
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="btn btn-dark" onClick={onClick}>
        {action}
      </button>
    </div>
  );
}

function Profile({ setPage }: { setPage: (p: PublicPage) => void }) {
  return (
    <main className="page-bg profile-page">
      <div className="profile-banner">
        <div className="container">
          <button className="back-link" onClick={() => setPage("register")}>
            ← Back to member register
          </button>
        </div>
      </div>
      <div className="container profile-layout">
        <section className="profile-main-card">
          <div className="verified-ribbon">
            <Icon name="shield" size={18} /> Live PSSA verification
          </div>
          <div className="profile-intro">
            <span className="profile-avatar large">LM</span>
            <div>
              <Status>Active · Verified</Status>
              <h1>Lerato Mokoena</h1>
              <p>
                Trading as <b>Lerato Finds</b>
              </p>
            </div>
          </div>
          <div className="certificate-callout">
            <div>
              <span>Certificate number</span>
              <strong>EC-2026-004821</strong>
            </div>
            <span className="qr-mini">▦</span>
          </div>
          <div className="detail-grid">
            <div>
              <span>Certified from</span>
              <b>01 March 2026</b>
            </div>
            <div>
              <span>Valid until</span>
              <b>28 February 2027</b>
            </div>
            <div>
              <span>Member location</span>
              <b>Johannesburg, Gauteng</b>
            </div>
            <div>
              <span>Last status check</span>
              <b>Today, 10:42 SAST</b>
            </div>
          </div>
          <hr />
          <h3>Approved sourcing scope</h3>
          <div className="scope-list large-scopes">
            <span>Fashion & accessories</span>
            <span>Beauty & cosmetics</span>
          </div>
          <h3>Verified trading channels</h3>
          <div className="channel-list">
            <div>
              <span className="channel-icon">@</span>
              <div>
                <b>@leratofinds</b>
                <small>Instagram · Verified</small>
              </div>
              <Icon name="check" />
            </div>
            <div>
              <span className="channel-icon">W</span>
              <div>
                <b>+27 72 ••• ••41</b>
                <small>WhatsApp Business · Verified</small>
              </div>
              <Icon name="check" />
            </div>
          </div>
        </section>
        <aside className="profile-aside">
          <div className="safe-card">
            <Icon name="shield" size={26} />
            <h3>This profile is live</h3>
            <p>
              Screenshots, copied badges and old certificates do not prove current status. Always
              return to this page before paying.
            </p>
            <div className="url-box">
              pssa.site/verify/EC-2026-004821 <Icon name="copy" size={16} />
            </div>
          </div>
          <div className="report-card">
            <h3>Concerned about this member?</h3>
            <p>Report misconduct or a channel that does not match this profile.</p>
            <button className="btn btn-outline btn-full" onClick={() => setPage("complaint")}>
              <Icon name="flag" /> Report this member
            </button>
          </div>
          <div className="disclaimer">
            <Icon name="warning" />
            <p>
              Certification confirms defined checks at a point in time. It is not a government
              licence or guarantee of a purchase.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Complaint({ setPage }: { setPage: (p: PublicPage) => void }) {
  const [type, setType] = useState("Misconduct");
  return (
    <main className="form-page page-bg">
      <div className="container form-layout">
        <aside>
          <span className="kicker">Complaints & concerns</span>
          <h1>Tell us what happened.</h1>
          <p>Reports are handled fairly and confidentially under the PSSA complaints process.</p>
          <div className="free-note">
            <Icon name="check" />
            <div>
              <b>There is no fee</b>
              <span>It is always free to submit a complaint or appeal.</span>
            </div>
          </div>
          <ol className="side-steps">
            <li className="active">
              <span>1</span>Your concern
            </li>
            <li>
              <span>2</span>Evidence & contact
            </li>
            <li>
              <span>3</span>Review & submit
            </li>
          </ol>
        </aside>
        <section className="form-card">
          <div className="form-card-head">
            <span>Step 1 of 3</span>
            <b>About your concern</b>
          </div>
          <label className="field-label">What would you like to report?</label>
          <div className="choice-grid">
            {["Misconduct", "Impersonation", "Badge misuse"].map((x) => (
              <button
                className={type === x ? "choice active" : "choice"}
                onClick={() => setType(x)}
                key={x}
              >
                <Icon
                  name={x === "Misconduct" ? "flag" : x === "Impersonation" ? "user" : "badge"}
                />
                <b>{x}</b>
                <small>
                  {x === "Misconduct"
                    ? "Unfair or harmful conduct"
                    : x === "Impersonation"
                      ? "Someone posing as a member"
                      : "Incorrect use of PSSA marks"}
                </small>
              </button>
            ))}
          </div>
          <label className="field-label">Member or account involved</label>
          <div className="input-with-icon">
            <Icon name="search" />
            <input placeholder="Search by name, number or social handle" />
          </div>
          <label className="field-label">What happened?</label>
          <textarea
            rows={5}
            placeholder="Include dates, amounts, what was agreed, and what response you received."
          />
          <div className="field-hint">0 / 2,000 characters</div>
          <label className="field-label">Evidence</label>
          <div className="upload-zone">
            <Icon name="upload" size={26} />
            <b>Drop files here or choose files</b>
            <span>Receipts, messages or screenshots · PDF, JPG, PNG · max 10 MB each</span>
          </div>
          <div className="two-fields">
            <label>
              <span>Your full name</span>
              <input placeholder="e.g. Ayesha Khan" />
            </label>
            <label>
              <span>Email address</span>
              <input type="email" placeholder="you@example.co.za" />
            </label>
          </div>
          <label className="check-row">
            <input type="checkbox" />{" "}
            <span>
              I consent to PSSA processing this information to assess and manage my report. I have
              read the Privacy Policy.
            </span>
          </label>
          <div className="form-actions">
            <button className="btn btn-ghost">Save and return later</button>
            <button className="btn btn-dark" onClick={() => setPage("complaint-confirm")}>
              Review & submit <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ComplaintConfirm({ setPage }: { setPage: (p: PublicPage) => void }) {
  return (
    <main className="confirmation-page">
      <div className="confirmation-card">
        <span className="success-icon">
          <Icon name="check" size={34} />
        </span>
        <span className="kicker">Report submitted</span>
        <h1>Thank you. We’ve received your concern.</h1>
        <p className="lead">
          A confirmation has been sent to <b>ayesha@example.co.za</b>. Keep your reference number
          for future correspondence.
        </p>
        <div className="reference-box">
          <span>Your reference number</span>
          <strong>PSSA-C-2026-0184</strong>
          <button>
            <Icon name="copy" /> Copy
          </button>
        </div>
        <h3>What happens next?</h3>
        <div className="next-steps">
          {[
            [
              "1",
              "Initial review",
              "We check the report and evidence, usually within 5 working days.",
            ],
            [
              "2",
              "Member response",
              "Where appropriate, the member receives a fair chance to respond.",
            ],
            [
              "3",
              "Decision & reasons",
              "You’ll receive an outcome with reasons and details of the appeal route.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-dark btn-full" onClick={() => setPage("home")}>
          Return to home
        </button>
      </div>
    </main>
  );
}

function OrderTemplate() {
  return (
    <main className="page-bg order-page">
      <section className="page-hero order-hero">
        <div className="container narrow">
          <span className="kicker light">Free customer resource</span>
          <h1>Start with a written order.</h1>
          <p>
            Record what you’re buying, what it will cost, and who is responsible before any money
            changes hands.
          </p>
          <button className="btn btn-green">
            <Icon name="download" /> Download blank order template · PDF
          </button>
        </div>
      </section>
      <div className="container order-layout">
        <article className="document-preview">
          <div className="doc-head">
            <Logo />
            <span>Customer order record</span>
          </div>
          <h2>Written sourcing order</h2>
          <p className="doc-sub">Complete and keep a copy before payment.</p>
          {[
            "1. Trader details",
            "2. Exact goods requested",
            "3. All charges and payment schedule",
            "4. Sourcing & delivery commitments",
            "5. Cancellation & refund terms",
            "6. Trader’s role",
          ].map((x, i) => (
            <section key={x}>
              <h3>{x}</h3>
              {i === 5 ? (
                <div className="role-checks">
                  <span>□ The shopper is the seller</span>
                  <span>□ The shopper acts as purchasing agent</span>
                </div>
              ) : (
                <>
                  <div className="doc-line" />
                  <div className="doc-line short" />
                </>
              )}
            </section>
          ))}
          <div className="doc-signatures">
            <span>Customer signature</span>
            <span>Trader signature</span>
          </div>
        </article>
        <aside className="order-aside">
          <span className="kicker">Why use it?</span>
          <h2>Clarity protects everyone.</h2>
          <p>
            A clear order reduces misunderstandings and creates a shared record if something goes
            wrong.
          </p>
          <ul>
            <li>
              <Icon name="check" /> Exact item, size, colour and condition
            </li>
            <li>
              <Icon name="check" /> Purchase price, service fee and delivery
            </li>
            <li>
              <Icon name="check" /> Expected sourcing and delivery dates
            </li>
            <li>
              <Icon name="check" /> Refund and cancellation conditions
            </li>
            <li>
              <Icon name="check" /> Whether the shopper is seller or agent
            </li>
          </ul>
          <div className="info-callout">
            <Icon name="warning" />
            <p>
              This template is a practical record, not legal advice. Consumer laws may still apply
              to your transaction.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

const memberNav: [MemberPage, IconName, string][] = [
  ["dashboard", "home", "Overview"],
  ["verification", "shield", "Verification"],
  ["tutorials", "play", "Tutorials"],
  ["exam", "book", "Assessment"],
  ["certificate", "badge", "Certificate & badge"],
];
const adminNav: [AdminPage, IconName, string][] = [
  ["applications", "file", "Applications"],
  ["cases", "flag", "Complaints"],
  ["members", "people", "Members"],
];

function Workspace({
  area,
  setArea,
  memberPage,
  setMemberPage,
  adminPage,
  setAdminPage,
}: {
  area: Area;
  setArea: (a: Area) => void;
  memberPage: MemberPage;
  setMemberPage: (p: MemberPage) => void;
  adminPage: AdminPage;
  setAdminPage: (p: AdminPage) => void;
}) {
  const isAdmin = area === "admin";
  const nav = isAdmin ? adminNav : memberNav;
  const current = isAdmin ? adminPage : memberPage;
  const setCurrent = (p: MemberPage | AdminPage) =>
    isAdmin ? setAdminPage(p as AdminPage) : setMemberPage(p as MemberPage);
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Logo />
        <div className="workspace-label">{isAdmin ? "Administration" : "Member portal"}</div>
        <nav>
          {nav.map(([p, icon, label]) => (
            <button
              key={p}
              className={
                current === p ||
                (p === "cases" && current === "case-detail") ||
                (p === "applications" && current === "review")
                  ? "active"
                  : ""
              }
              onClick={() => setCurrent(p)}
            >
              <Icon name={icon} />
              {label}
              {label === "Complaints" && <i>4</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setArea(isAdmin ? "member" : "admin")}>
            <Icon name={isAdmin ? "user" : "lock"} /> Switch to {isAdmin ? "member" : "admin"} demo
          </button>
          <button onClick={() => setArea("public")}>
            <Icon name="arrow" /> View public site
          </button>
          <div className="user-chip">
            <span>{isAdmin ? "ZN" : "LM"}</span>
            <div>
              <b>{isAdmin ? "Zanele Nkosi" : "Lerato Mokoena"}</b>
              <small>{isAdmin ? "Senior reviewer" : "Applicant"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-top">
          <button className="mobile-menu">
            <Icon name="menu" />
          </button>
          <div>
            <span className="mobile-logo">PSSA</span>
          </div>
          <div className="top-actions">
            <button>
              <Icon name="mail" />
            </button>
            <span className="top-avatar">{isAdmin ? "ZN" : "LM"}</span>
          </div>
        </header>
        {isAdmin ? (
          <AdminContent page={adminPage} setPage={setAdminPage} />
        ) : (
          <MemberContent page={memberPage} setPage={setMemberPage} />
        )}
      </div>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace-title">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}

function MemberContent({ page, setPage }: { page: MemberPage; setPage: (p: MemberPage) => void }) {
  if (page === "verification") return <Verification />;
  if (page === "tutorials") return <Tutorials setPage={setPage} />;
  if (page === "exam") return <Exam setPage={setPage} />;
  if (page === "results") return <ExamResults setPage={setPage} />;
  if (page === "certificate") return <Certificate />;
  if (page === "login") return <Auth />;
  return <Dashboard setPage={setPage} />;
}

function Dashboard({ setPage }: { setPage: (p: MemberPage) => void }) {
  const steps = [
    ["Profile", "Complete", "check"],
    ["Verification documents", "Action needed", "shield"],
    ["Conduct tutorials", "3 of 4 complete", "play"],
    ["Entrance assessment", "Not started", "book"],
    ["Review", "Locked", "eye"],
    ["Certified", "Locked", "badge"],
  ];
  return (
    <div className="workspace-content">
      <PageTitle
        eyebrow="Good morning, Lerato"
        title="Your application"
        text="You’re making good progress. Complete the items below to submit for review."
        action={<Status tone="blue">Application in progress</Status>}
      />
      <div className="progress-card">
        <div className="progress-head">
          <div>
            <span>Overall progress</span>
            <strong>58%</strong>
          </div>
          <p>3 steps need your attention</p>
        </div>
        <div className="progress-track">
          <i style={{ width: "58%" }} />
        </div>
        <div className="application-steps">
          {steps.map(([title, status, icon], i) => (
            <div
              className={i === 1 ? "app-step current" : i === 0 ? "app-step done" : "app-step"}
              key={title}
            >
              <span className="app-step-icon">
                {i === 0 ? <Icon name="check" /> : <Icon name={icon as IconName} />}
              </span>
              <div>
                <b>{title}</b>
                <small>{status}</small>
              </div>
              {i === 1 && (
                <button onClick={() => setPage("verification")}>
                  Continue <Icon name="chevron" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="panel-icon">
                <Icon name="warning" />
              </span>
              <div>
                <h3>Action needed</h3>
                <p>Two items are holding up your application.</p>
              </div>
            </div>
          </div>
          <div className="task-row">
            <div>
              <Status tone="amber">Needs resubmission</Status>
              <b>Bank account evidence</b>
              <p>The account holder name is not visible.</p>
            </div>
            <button onClick={() => setPage("verification")}>
              Fix now <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="task-row">
            <div>
              <Status tone="blue">In progress</Status>
              <b>Final conduct tutorial</b>
              <p>12 minutes remaining.</p>
            </div>
            <button onClick={() => setPage("tutorials")}>
              Continue <Icon name="arrow" size={15} />
            </button>
          </div>
        </section>
        <aside className="panel help-panel">
          <span className="help-art">
            <Icon name="mail" size={30} />
          </span>
          <h3>Need help?</h3>
          <p>
            Our applicant support team can explain the process, but cannot influence a decision.
          </p>
          <button className="btn btn-outline btn-full">Contact support</button>
        </aside>
      </div>
    </div>
  );
}

function Verification() {
  const docs = [
    ["South African ID document", "Accepted", "green", "ID front and back · PDF", "shield"],
    [
      "Proof of residence or business registration",
      "Under review",
      "blue",
      "Municipal account · PDF",
      "home",
    ],
    ["Receiving bank account evidence", "Needs resubmission", "red", "Bank letter · PDF", "bank"],
    ["Social & sales channels", "Uploaded", "grey", "2 channels submitted", "people"],
  ];
  return (
    <div className="workspace-content">
      <PageTitle
        eyebrow="Application · Step 2 of 6"
        title="Verification documents"
        text="Provide clear, current evidence for each verification check."
        action={
          <button className="btn btn-dark">
            <Icon name="upload" /> Upload document
          </button>
        }
      />
      <div className="notice blue">
        <Icon name="shield" />
        <div>
          <b>Uploading is not the same as passing verification.</b>
          <p>
            Each item is reviewed against the PSSA verification standard. We’ll tell you if anything
            needs to be replaced.
          </p>
        </div>
      </div>
      <div className="document-grid">
        {docs.map(([name, status, tone, desc, icon]) => (
          <article className="document-card" key={name}>
            <div className="doc-card-top">
              <span>
                <Icon name={icon as IconName} />
              </span>
              <Status tone={tone as "green" | "blue" | "red" | "grey"}>{status}</Status>
            </div>
            <h3>{name}</h3>
            <p>{desc}</p>
            <div className="doc-actions">
              <button>
                <Icon name="eye" /> View
              </button>
              <button>
                <Icon name="upload" /> Replace
              </button>
            </div>
            {status === "Needs resubmission" && (
              <div className="doc-error">
                <Icon name="warning" />
                <span>
                  <b>We couldn’t accept this file.</b> The account holder name and account number
                  must both be visible.
                </span>
              </div>
            )}
          </article>
        ))}
      </div>
      <section className="panel channel-panel">
        <div className="panel-head">
          <div>
            <span className="panel-icon">
              <Icon name="people" />
            </span>
            <div>
              <h3>Channels you control</h3>
              <p>Customers will use these to confirm they are dealing with you.</p>
            </div>
          </div>
          <button className="btn btn-outline">Add channel</button>
        </div>
        <div className="channel-table">
          <div>
            <span className="channel-icon">@</span>
            <b>@leratofinds</b>
            <span>Instagram</span>
            <Status tone="green">Confirmed</Status>
            <button>•••</button>
          </div>
          <div>
            <span className="channel-icon">W</span>
            <b>+27 72 ••• ••41</b>
            <span>WhatsApp Business</span>
            <Status tone="blue">Code sent</Status>
            <button>•••</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Tutorials({ setPage }: { setPage: (p: MemberPage) => void }) {
  const lessons = [
    ["Fair, clear and honest trading", "08:42", true],
    ["Written orders and fee disclosure", "11:18", true],
    ["Cancellations, refunds and delays", "09:55", true],
    ["Badge use and customer complaints", "12:04", false],
  ];
  return (
    <div className="workspace-content">
      <PageTitle
        eyebrow="Application · Step 3 of 6"
        title="Conduct tutorials"
        text="Learn the minimum conduct expected of every PSSA member."
      />
      <div className="tutorial-layout">
        <section className="video-card">
          <div className="video-screen">
            <span className="video-label">LESSON 4 · CODE OF CONDUCT</span>
            <button>
              <Icon name="play" size={30} />
            </button>
            <p>Using your certification responsibly</p>
          </div>
          <div className="video-info">
            <div>
              <h3>Badge use and customer complaints</h3>
              <p>
                How to describe your status accurately and respond constructively when a customer
                raises a concern.
              </p>
            </div>
            <span>12:04</span>
          </div>
        </section>
        <aside className="lesson-list">
          <div className="lesson-head">
            <h3>Course content</h3>
            <span>3 of 4 complete</span>
          </div>
          {lessons.map(([title, time, done], i) => (
            <button className={!done ? "current" : ""} key={title as string}>
              <span className={done ? "lesson-check done" : "lesson-check"}>
                {done ? <Icon name="check" /> : i + 1}
              </span>
              <div>
                <b>{title}</b>
                <small>
                  <Icon name="clock" size={13} /> {time as string}
                </small>
              </div>
              {!done && <Icon name="play" />}
            </button>
          ))}
          <button className="btn btn-dark btn-full exam-button" onClick={() => setPage("exam")}>
            Go to assessment <Icon name="arrow" size={16} />
          </button>
        </aside>
      </div>
    </div>
  );
}

function Exam({ setPage }: { setPage: (p: MemberPage) => void }) {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <div className="workspace-content exam-wrap">
      <div className="exam-top">
        <button onClick={() => setPage("tutorials")}>← Exit assessment</button>
        <span>Question 7 of 15</span>
        <b>18:24 remaining</b>
      </div>
      <div className="exam-progress">
        <i style={{ width: "46%" }} />
      </div>
      <section className="exam-card">
        <span className="question-no">QUESTION 07</span>
        <h1>
          A customer asks you to source shoes for R2,400. Your service fee is R350 and delivery is
          R120. What must happen before they pay?
        </h1>
        <div className="answer-list">
          {[
            "Only tell them the R2,400 purchase price",
            "Clearly disclose all charges and the total of R2,870 in writing",
            "Mention the additional fees after you purchase the shoes",
            "You do not need to disclose delivery charges",
          ].map((x, i) => (
            <button className={answer === i ? "selected" : ""} onClick={() => setAnswer(i)} key={x}>
              <span>{String.fromCharCode(65 + i)}</span>
              {x}
              <i>{answer === i && <Icon name="check" />}</i>
            </button>
          ))}
        </div>
        <div className="exam-actions">
          <button className="btn btn-ghost">Previous</button>
          <button
            className="btn btn-dark"
            disabled={answer === null}
            onClick={() => setPage("results")}
          >
            Next question <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function ExamResults({ setPage }: { setPage: (p: MemberPage) => void }) {
  const [passed, setPassed] = useState(true);
  return (
    <div className="workspace-content result-wrap">
      <div className="state-switch result-switch">
        <button onClick={() => setPassed(true)}>Pass state</button>
        <button onClick={() => setPassed(false)}>Fail state</button>
      </div>
      <section className={`result-card ${passed ? "" : "failed"}`}>
        <span className="result-icon">
          <Icon name={passed ? "check" : "close"} size={36} />
        </span>
        <span className="kicker">{passed ? "Assessment passed" : "Not passed yet"}</span>
        <h1>{passed ? "Well done, Lerato." : "You’re close. Try again."}</h1>
        <p>
          {passed
            ? "You demonstrated a sound understanding of the PSSA Code of Conduct."
            : "Review the recommended lessons before your next attempt."}
        </p>
        <div className="score-ring">
          <strong>{passed ? "87%" : "67%"}</strong>
          <span>Score</span>
        </div>
        <div className="score-meta">
          <div>
            <span>Pass mark</span>
            <b>80%</b>
          </div>
          <div>
            <span>Correct answers</span>
            <b>{passed ? "13 of 15" : "10 of 15"}</b>
          </div>
          <div>
            <span>Attempt</span>
            <b>1 of 3</b>
          </div>
        </div>
        {passed ? (
          <div className="notice green">
            <Icon name="check" />
            <div>
              <b>Your application can now move to review</b>
              <p>We’ll notify you when all document checks are complete.</p>
            </div>
          </div>
        ) : (
          <div className="notice amber">
            <Icon name="clock" />
            <div>
              <b>You can retry in 24 hours</b>
              <p>Focus on fee disclosure, refund responsibilities and badge rules.</p>
            </div>
          </div>
        )}
        <button
          className="btn btn-dark btn-full"
          onClick={() => setPage(passed ? "dashboard" : "tutorials")}
        >
          {passed ? "Return to application" : "Review lessons"}
        </button>
      </section>
    </div>
  );
}

function Certificate() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="workspace-content">
      <PageTitle
        eyebrow="Membership"
        title="Certificate & badge"
        text="Use these assets only while your membership status is active."
        action={<Status>Active · 284 days remaining</Status>}
      />
      <div className="certificate-layout">
        <section className="certificate-paper">
          <div className="cert-border">
            <div className="cert-head">
              <Logo />
              <span>Certificate of membership</span>
            </div>
            <div className="cert-body">
              <span className="cert-kicker">This is to certify that</span>
              <h1>Lerato Mokoena</h1>
              <p>
                trading as <b>Lerato Finds</b>
              </p>
              <div className="cert-rule" />
              <p>
                has met the Personal Shoppers and Sourcing Association’s private verification and
                conduct requirements for the approved scope:
              </p>
              <h3>Fashion & accessories · Beauty & cosmetics</h3>
              <div className="cert-meta">
                <div>
                  <span>Certificate number</span>
                  <b>EC-2026-004821</b>
                </div>
                <div>
                  <span>Valid from</span>
                  <b>01 March 2026</b>
                </div>
                <div>
                  <span>Valid until</span>
                  <b>28 February 2027</b>
                </div>
                <div className="qr">
                  ▦<small>Live status</small>
                </div>
              </div>
            </div>
          </div>
          <button className="btn btn-dark download-cert">
            <Icon name="download" /> Download certificate · PDF
          </button>
        </section>
        <aside className="asset-column">
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="panel-icon">
                  <Icon name="badge" />
                </span>
                <div>
                  <h3>Your digital badge</h3>
                  <p>Links directly to your live profile.</p>
                </div>
              </div>
            </div>
            <div className="badge-preview">
              <Icon name="shield" size={38} />
              <div>
                <b>PSSA VERIFIED</b>
                <span>ACTIVE MEMBER · 2026/27</span>
              </div>
            </div>
            <label className="copy-field">
              <span>Badge link</span>
              <div>
                <input readOnly value="https://pssa.site/v/EC-2026-004821" />
                <button onClick={() => setCopied(true)}>
                  <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
          </section>
          <section className="panel renewal-card">
            <div className="renewal-ring">
              <strong>284</strong>
              <span>days</span>
            </div>
            <div>
              <span className="kicker">Annual renewal</span>
              <h3>Renew before 28 Feb 2027</h3>
              <p>Renewal includes updated verification checks and a short refresher assessment.</p>
              <button className="btn btn-outline btn-full">Start renewal</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Auth() {
  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <span className="kicker">Member portal</span>
        <h1>Welcome back</h1>
        <p>Sign in to continue your application or manage your membership.</p>
        <label>
          <span>Email address</span>
          <input type="email" placeholder="you@example.co.za" />
        </label>
        <button className="btn btn-dark btn-full">Continue with email</button>
        <div className="auth-divider">
          <span>secure sign in</span>
        </div>
        <div className="otp-note">
          <Icon name="mail" />
          <p>We’ll send a one-time verification code to your email. No password needed.</p>
        </div>
        <small>
          New to PSSA? <button>Start an application</button>
        </small>
      </div>
    </div>
  );
}

function AdminContent({ page, setPage }: { page: AdminPage; setPage: (p: AdminPage) => void }) {
  if (page === "review") return <ApplicationReview />;
  if (page === "cases") return <Cases setPage={setPage} />;
  if (page === "case-detail") return <CaseDetail />;
  if (page === "members") return <MembersManagement />;
  return <Applications setPage={setPage} />;
}

function Applications({ setPage }: { setPage: (p: AdminPage) => void }) {
  const rows = [
    [
      "Lerato Mokoena",
      "Lerato Finds",
      "06 Mar 2026",
      "2/4 accepted",
      "100%",
      "87%",
      "Ready for review",
    ],
    ["Sipho Dlamini", "Plug Source CPT", "05 Mar 2026", "3/4 accepted", "75%", "—", "In progress"],
    [
      "Amina Patel",
      "Curated by Amina",
      "04 Mar 2026",
      "4/4 accepted",
      "100%",
      "93%",
      "Ready for review",
    ],
    [
      "Zinhle Khumalo",
      "Zee Luxe Finds",
      "02 Mar 2026",
      "2/4 accepted",
      "100%",
      "67%",
      "Action needed",
    ],
    [
      "Johan van Wyk",
      "The Gear Hunter",
      "28 Feb 2026",
      "4/4 accepted",
      "100%",
      "80%",
      "Under review",
    ],
  ];
  return (
    <div className="workspace-content admin-content">
      <PageTitle
        eyebrow="Operations"
        title="Applications"
        text="Review and decide new membership applications."
        action={
          <button className="btn btn-outline">
            <Icon name="download" /> Export
          </button>
        }
      />
      <div className="metric-grid">
        <div>
          <span>Awaiting review</span>
          <strong>18</strong>
          <small>+4 this week</small>
        </div>
        <div>
          <span>Needs information</span>
          <strong>7</strong>
          <small>3 overdue</small>
        </div>
        <div>
          <span>Average review time</span>
          <strong>3.2d</strong>
          <small>Target: 5 days</small>
        </div>
        <div>
          <span>Approval rate</span>
          <strong>74%</strong>
          <small>Last 90 days</small>
        </div>
      </div>
      <section className="admin-table-panel">
        <div className="table-tools">
          <div className="input-with-icon">
            <Icon name="search" />
            <input placeholder="Search applicant or trading name" />
          </div>
          <select>
            <option>All statuses</option>
            <option>Ready for review</option>
          </select>
          <select>
            <option>Submitted: newest</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Submitted</th>
                <th>Verification</th>
                <th>Tutorials</th>
                <th>Exam</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r[0]} onClick={() => i === 0 && setPage("review")}>
                  <td>
                    <span className="table-avatar">
                      {r[0]
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div>
                      <b>{r[0]}</b>
                      <small>{r[1]}</small>
                    </div>
                  </td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                  <td>{r[4]}</td>
                  <td>
                    <b>{r[5]}</b>
                  </td>
                  <td>
                    <Status
                      tone={
                        r[6] === "Ready for review"
                          ? "green"
                          : r[6] === "Action needed"
                            ? "red"
                            : "blue"
                      }
                    >
                      {r[6]}
                    </Status>
                  </td>
                  <td>
                    <Icon name="chevron" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Showing 1–5 of 42 applications{" "}
          <div>
            <button>←</button>
            <button>1</button>
            <button>2</button>
            <button>3</button>
            <button>→</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ApplicationReview() {
  const [decision, setDecision] = useState<string | null>(null);
  return (
    <div className="workspace-content admin-content">
      <button className="back-link">← Back to applications</button>
      <PageTitle
        eyebrow="Application · APP-2026-0098"
        title="Lerato Mokoena"
        text="Lerato Finds · Submitted 06 March 2026"
        action={<Status tone="green">Ready for review</Status>}
      />
      <div className="review-layout">
        <div className="review-main">
          <section className="panel review-section">
            <div className="panel-head">
              <div>
                <span className="panel-icon">
                  <Icon name="shield" />
                </span>
                <div>
                  <h3>Verification standard</h3>
                  <p>Review each item against the documented criteria.</p>
                </div>
              </div>
              <b>3 of 4 complete</b>
            </div>
            {[
              "Identity matches application",
              "Address evidence is current",
              "Bank account holder matches applicant",
              "Trading channels are controlled by applicant",
            ].map((x, i) => (
              <div className="checklist-row" key={x}>
                <button className={i < 3 ? "checked" : ""}>{i < 3 && <Icon name="check" />}</button>
                <div>
                  <b>{x}</b>
                  <small>
                    {i === 3 ? "Confirmation code pending" : "Evidence reviewed and accepted"}
                  </small>
                </div>
                <button className="view-file">
                  <Icon name="eye" /> View evidence
                </button>
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="panel-icon">
                  <Icon name="book" />
                </span>
                <div>
                  <h3>Learning & assessment</h3>
                  <p>Completed 08 March 2026</p>
                </div>
              </div>
            </div>
            <div className="assessment-summary">
              <div>
                <span>Tutorial completion</span>
                <b>4 / 4</b>
                <Status>Complete</Status>
              </div>
              <div>
                <span>Entrance assessment</span>
                <b>87%</b>
                <Status>Passed</Status>
              </div>
              <div>
                <span>Attempts used</span>
                <b>1 / 3</b>
                <span>12m 48s</span>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="panel-icon">
                  <Icon name="file" />
                </span>
                <div>
                  <h3>Reviewer notes</h3>
                  <p>Visible only to authorised PSSA reviewers.</p>
                </div>
              </div>
            </div>
            <textarea
              rows={4}
              placeholder="Record relevant observations and the basis for your decision..."
            />
          </section>
        </div>
        <aside className="review-aside">
          <section className="panel applicant-summary">
            <span className="member-avatar">LM</span>
            <h3>Lerato Mokoena</h3>
            <p>lerato@example.co.za</p>
            <div>
              <span>Applied scope</span>
              <b>Fashion · Beauty</b>
            </div>
            <div>
              <span>Province</span>
              <b>Gauteng</b>
            </div>
            <div>
              <span>Application date</span>
              <b>06 Mar 2026</b>
            </div>
          </section>
          <section className="panel decision-box">
            <h3>Record decision</h3>
            <p>A reason is required and will form part of the decision record.</p>
            <label>
              Decision reason
              <textarea rows={3} placeholder="Explain the evidence and standard applied..." />
            </label>
            <div className="decision-actions">
              <button className="btn approve" onClick={() => setDecision("Approved")}>
                <Icon name="check" /> Approve
              </button>
              <button className="btn request" onClick={() => setDecision("More info requested")}>
                <Icon name="mail" /> Request info
              </button>
              <button className="btn reject" onClick={() => setDecision("Rejected")}>
                <Icon name="close" /> Reject
              </button>
            </div>
            {decision && (
              <div className="decision-toast">
                <Icon name="check" /> Decision draft: {decision}
              </div>
            )}
          </section>
          <section className="panel history">
            <h3>Decision history</h3>
            <div>
              <span />
              <p>
                <b>Ready for review</b>
                <small>08 Mar · System</small>
              </p>
            </div>
            <div>
              <span />
              <p>
                <b>Application submitted</b>
                <small>06 Mar · Applicant</small>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Cases({ setPage }: { setPage: (p: AdminPage) => void }) {
  const cases = [
    ["PSSA-C-2026-0184", "Ayesha Khan", "Lerato Mokoena", "Misconduct", "Received", "Today, 09:14"],
    [
      "PSSA-C-2026-0179",
      "Karabo Molefe",
      "Thabo Ndlovu",
      "Badge misuse",
      "Awaiting response",
      "Yesterday",
    ],
    [
      "PSSA-C-2026-0168",
      "Michael Smith",
      "Unknown account",
      "Impersonation",
      "Under review",
      "08 Mar 2026",
    ],
    [
      "PSSA-C-2026-0142",
      "Nandi Cele",
      "Naledi Jacobs",
      "Misconduct",
      "Under appeal",
      "02 Mar 2026",
    ],
  ];
  return (
    <div className="workspace-content admin-content">
      <PageTitle
        eyebrow="Case management"
        title="Complaints"
        text="Track reports, responses, decisions and appeals."
      />
      <div className="case-board">
        {["Received", "Under review", "Awaiting response", "Under appeal"].map((x, i) => (
          <div key={x}>
            <span>{x}</span>
            <b>{[4, 6, 3, 1][i]}</b>
          </div>
        ))}
      </div>
      <section className="admin-table-panel">
        <div className="table-tools">
          <div className="input-with-icon">
            <Icon name="search" />
            <input placeholder="Search reference, complainant or member" />
          </div>
          <select>
            <option>All case statuses</option>
          </select>
          <select>
            <option>All complaint types</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Complainant</th>
                <th>Member / account</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cases.map((r, i) => (
                <tr key={r[0]} onClick={() => i === 0 && setPage("case-detail")}>
                  <td>
                    <b>{r[0]}</b>
                  </td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                  <td>
                    <Status tone={i === 0 ? "blue" : i === 3 ? "red" : "amber"}>{r[4]}</Status>
                  </td>
                  <td>{r[5]}</td>
                  <td>
                    <Icon name="chevron" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CaseDetail() {
  return (
    <div className="workspace-content admin-content">
      <button className="back-link">← Back to complaints</button>
      <PageTitle
        eyebrow="PSSA-C-2026-0184 · Misconduct"
        title="Order not delivered after payment"
        text="Received today at 09:14 · Assigned to you"
        action={<Status tone="blue">Under review</Status>}
      />
      <div className="case-layout">
        <div className="review-main">
          <section className="panel case-summary">
            <h3>Complaint summary</h3>
            <p>
              I paid R3,850 for two pairs of sneakers on 12 February. Delivery was promised within
              10 working days. I have received no tracking details and my last three WhatsApp
              messages have not been answered.
            </p>
            <div className="evidence-files">
              <button>
                <Icon name="file" />
                <span>
                  <b>payment_receipt.pdf</b>
                  <small>PDF · 284 KB</small>
                </span>
                <Icon name="download" />
              </button>
              <button>
                <Icon name="file" />
                <span>
                  <b>whatsapp_messages.png</b>
                  <small>PNG · 1.2 MB</small>
                </span>
                <Icon name="download" />
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="panel-icon">
                  <Icon name="mail" />
                </span>
                <div>
                  <h3>Member response</h3>
                  <p>No response requested yet.</p>
                </div>
              </div>
              <button className="btn btn-outline">Request response</button>
            </div>
            <textarea
              rows={4}
              placeholder="Specify the allegations and information the member must address..."
            />
          </section>
          <section className="panel outcome-panel">
            <h3>Decision & outcome</h3>
            <p>Record findings with reasons after considering all available evidence.</p>
            <div className="outcome-options">
              {["No breach", "Corrective action", "Suspension", "Revocation"].map((x) => (
                <button key={x}>{x}</button>
              ))}
            </div>
            <textarea rows={4} placeholder="Decision reasons..." />
          </section>
        </div>
        <aside className="review-aside">
          <section className="panel">
            <h3>Case timeline</h3>
            <div className="timeline">
              <div className="current">
                <span />
                <p>
                  <b>Initial review started</b>
                  <small>Today, 10:02 · Z. Nkosi</small>
                </p>
              </div>
              <div>
                <span />
                <p>
                  <b>Case received</b>
                  <small>Today, 09:14 · System</small>
                </p>
              </div>
            </div>
          </section>
          <section className="panel party-card">
            <h3>Parties</h3>
            <span>COMPLAINANT</span>
            <b>Ayesha Khan</b>
            <small>ayesha@example.co.za</small>
            <hr />
            <span>MEMBER</span>
            <b>Lerato Mokoena</b>
            <small>EC-2026-004821 · Active</small>
          </section>
          <section className="panel conflict-box">
            <label className="check-row">
              <input type="checkbox" />
              <span>
                <b>Conflict of interest declaration</b>I confirm I have no personal, financial or
                professional conflict in this case.
              </span>
            </label>
            <p>This declaration is required before you can decide the case.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MembersManagement() {
  const [status, setStatus] = useState("Active");
  return (
    <div className="workspace-content admin-content">
      <PageTitle
        eyebrow="Register management"
        title="Members"
        text="Maintain live status, reasons and the public record."
        action={
          <button className="btn btn-outline">
            <Icon name="download" /> Export register
          </button>
        }
      />
      <section className="admin-table-panel">
        <div className="table-tools">
          <div className="input-with-icon">
            <Icon name="search" />
            <input placeholder="Search name, trading name or certificate" />
          </div>
          <select>
            <option>All statuses</option>
          </select>
        </div>
        <div className="member-management">
          <div className="selected-member">
            <span className="member-avatar">LM</span>
            <div>
              <h3>Lerato Mokoena</h3>
              <p>Lerato Finds · EC-2026-004821</p>
              <div className="scope-list">
                <span>Fashion</span>
                <span>Beauty</span>
              </div>
            </div>
            <Status>{status}</Status>
          </div>
          <div className="status-control">
            <div>
              <h3>Change membership status</h3>
              <p>
                Changes appear immediately on the public register and are recorded in the audit log.
              </p>
            </div>
            <div className="status-options">
              {["Active", "Suspended", "Expired", "Revoked"].map((x) => (
                <button
                  className={status === x ? "active" : ""}
                  onClick={() => setStatus(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
            <label>
              <span>Reason for status change</span>
              <textarea rows={3} placeholder="Required for suspension, expiry or revocation..." />
            </label>
            <label className="check-row">
              <input type="checkbox" />
              <span>
                I confirm I have no conflict of interest and this change is supported by an
                authorised decision.
              </span>
            </label>
            <button className="btn btn-dark">Save status change</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ScreensReference() {
  const [area, setArea] = useState<Area>("admin");
  const [publicPage, setPublicPage] = useState<PublicPage>("home");
  const [memberPage, setMemberPage] = useState<MemberPage>("dashboard");
  const [adminPage, setAdminPage] = useState<AdminPage>("applications");
  const goPublic = (p: PublicPage) => {
    setPublicPage(p);
    window.scrollTo(0, 0);
  };

  if (area !== "public")
    return (
      <Workspace
        area={area}
        setArea={setArea}
        memberPage={memberPage}
        setMemberPage={setMemberPage}
        adminPage={adminPage}
        setAdminPage={setAdminPage}
      />
    );

  return (
    <div>
      <PublicHeader setArea={setArea} setPage={goPublic} />
      {publicPage === "home" && <Home setPage={goPublic} />}
      {publicPage === "register" && <Register setPage={goPublic} />}
      {publicPage === "profile" && <Profile setPage={goPublic} />}
      {publicPage === "complaint" && <Complaint setPage={goPublic} />}
      {publicPage === "complaint-confirm" && <ComplaintConfirm setPage={goPublic} />}
      {publicPage === "order" && <OrderTemplate />}
      <Footer setPage={goPublic} />
    </div>
  );
}
