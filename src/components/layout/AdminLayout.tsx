import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminApi } from "../../lib/adminApi";
import { api } from "../../lib/api";
import { Icon, type IconName } from "../Icon";
import { Wordmark } from "../Wordmark";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview & Vetting",
    items: [
      { to: "/admin", label: "Overview", icon: "dashboard", end: true },
      { to: "/admin/verifications", label: "Verifications", icon: "shield" },
      { to: "/admin/renewals", label: "Renewals", icon: "audit" },
      { to: "/admin/users", label: "Members", icon: "people" },
    ],
  },
  {
    heading: "Trust & Safety",
    items: [
      { to: "/admin/complaints", label: "Cases & Safety", icon: "flag" },
    ],
  },
  {
    heading: "Governance",
    items: [
      { to: "/admin/tutorials", label: "Tutorials", icon: "play" },
      { to: "/admin/audit", label: "Audit Log", icon: "audit" },
      { to: "/admin/notifications", label: "Notifications", icon: "bell" },
    ],
  },
];

interface AmbientProfile {
  label: string;
  section: string;
  primary: string;
  secondary: string;
  tertiary: string;
}

function getAmbientProfile(pathname: string): AmbientProfile {
  if (pathname.startsWith("/admin/verifications")) {
    return {
      label: "Vetting & Credentials",
      section: "Verifications",
      primary: "rgba(24, 162, 105, 0.14)",
      secondary: "rgba(217, 199, 163, 0.45)",
      tertiary: "rgba(11, 32, 55, 0.08)",
    };
  }
  if (pathname.startsWith("/admin/users")) {
    return {
      label: "Member Directory",
      section: "Members",
      primary: "rgba(217, 199, 163, 0.36)",
      secondary: "rgba(24, 162, 105, 0.12)",
      tertiary: "rgba(11, 32, 55, 0.06)",
    };
  }
  if (pathname.startsWith("/admin/listings")) {
    return {
      label: "Verified Specialties",
      section: "Shopper Profiles",
      primary: "rgba(24, 162, 105, 0.15)",
      secondary: "rgba(239, 230, 212, 0.62)",
      tertiary: "rgba(16, 42, 70, 0.05)",
    };
  }
  if (pathname.startsWith("/admin/complaints")) {
    return {
      label: "Consumer Protection",
      section: "Cases & Complaints",
      primary: "rgba(217, 199, 163, 0.42)",
      secondary: "rgba(11, 32, 55, 0.08)",
      tertiary: "rgba(24, 162, 105, 0.09)",
    };
  }
  if (
    pathname.startsWith("/admin/audit") ||
    pathname.startsWith("/admin/tutorials") ||
    pathname.startsWith("/admin/notifications")
  ) {
    const section = pathname.split("/")[2] ?? "Governance";
    return {
      label: "Association Governance",
      section: section.charAt(0).toUpperCase() + section.slice(1),
      primary: "rgba(16, 42, 70, 0.09)",
      secondary: "rgba(239, 230, 212, 0.52)",
      tertiary: "rgba(24, 162, 105, 0.10)",
    };
  }
  return {
    label: "Executive Overview",
    section: "Overview",
    primary: "rgba(24, 162, 105, 0.13)",
    secondary: "rgba(239, 230, 212, 0.65)",
    tertiary: "rgba(11, 32, 55, 0.06)",
  };
}

interface TooltipState {
  label: string;
  top: number;
  left: number;
}

function SidebarContent({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  isMobile = false,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  isMobile?: boolean;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, label: string) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 14,
    });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden bg-navy text-white ring-1 ring-white/12 ${
        isMobile ? "rounded-r-[26px]" : "rounded-[26px]"
      }`}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #18a269 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-60px] bottom-16 h-56 w-56 rounded-full opacity-12 blur-3xl"
        style={{ background: "radial-gradient(circle, #efe6d4 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div
        className={`relative flex items-center border-b border-white/10 transition-all duration-300 ${
          collapsed ? "justify-center px-3 py-5" : "justify-between px-5 py-5"
        }`}
      >
        {collapsed ? (
          <Link
            to="/admin"
            onMouseEnter={(e) => showTooltip(e, "PSASA Operations")}
            onMouseLeave={hideTooltip}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-white/14 to-white/4 font-display text-xl font-bold text-white ring-1 ring-white/15 transition hover:scale-105 hover:ring-green/50"
            aria-label="PSASA Admin home"
          >
            P<span className="text-green">.</span>
          </Link>
        ) : (
          <Wordmark tone="light" compact />
        )}
      </div>

      <div className={`relative flex-1 space-y-5 overflow-y-auto py-5 ${collapsed ? "px-2.5" : "px-3.5"}`}>
        {NAV_GROUPS.map((group, idx) => (
          <div key={group.heading}>
            {collapsed ? (
              idx > 0 && <div className="mx-auto mb-3 h-px w-7 rounded-full bg-white/12" />
            ) : (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sand-dark/65">
                {group.heading}
              </p>
            )}
            <nav aria-label={group.heading} className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  onMouseEnter={(e) => showTooltip(e, item.label)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip(e, item.label)}
                  onBlur={hideTooltip}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-2xl transition-all duration-200 ${
                      collapsed ? "justify-center p-2" : "justify-between px-3 py-2.5 text-[13.5px] font-medium"
                    } ${
                      isActive
                        ? "bg-gradient-to-r from-white/16 to-white/6 text-white shadow-[0_6px_18px_rgba(0,0,0,0.2)] ring-1 ring-white/12"
                        : "text-white/70 hover:bg-white/7 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
                        <span
                          className={`flex items-center justify-center rounded-xl transition-all duration-200 ${
                            collapsed ? "h-10 w-10" : "h-7 w-7"
                          } ${
                            isActive
                              ? "bg-green/22 text-green shadow-[0_0_14px_rgba(24,162,105,0.28)]"
                              : "bg-white/5 text-green/85 group-hover:scale-105 group-hover:bg-white/12 group-hover:text-green"
                          }`}
                        >
                          <Icon name={item.icon} size={collapsed ? 18 : 15} />
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>
                      {!collapsed && isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#18a269]" />
                      )}
                      {collapsed && isActive && (
                        <span className="absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#18a269]" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div
        className={`relative border-t border-white/10 bg-navy-2/55 backdrop-blur-sm space-y-2 ${
          collapsed ? "p-2.5" : "p-4"
        }`}
      >
        <button
          type="button"
          onClick={async () => {
            onNavigate?.();
            try {
              sessionStorage.removeItem("pssa_admin_authed");
            } catch {
              // ignore
            }
            adminApi.clearCache();
            await api("/auth/logout", { method: "POST" }).catch(() => {});
            window.location.assign("/login");
          }}
          onMouseEnter={(e) => showTooltip(e, "Sign out")}
          onMouseLeave={hideTooltip}
          onFocus={(e) => showTooltip(e, "Sign out")}
          onBlur={hideTooltip}
          aria-label="Sign out"
          className={`flex w-full items-center rounded-2xl text-xs font-medium text-white/65 transition hover:bg-white/8 hover:text-white ${
            collapsed ? "justify-center p-2.5" : "gap-2.5 px-3.5 py-2"
          }`}
        >
          <Icon name="logout" size={16} />
          {!collapsed && <span>Sign out</span>}
        </button>

        {!isMobile && onToggleCollapse && (
          <button
            type="button"
            onClick={() => {
              hideTooltip();
              onToggleCollapse();
            }}
            onMouseEnter={(e) => showTooltip(e, collapsed ? "Expand sidebar" : "Minimize sidebar")}
            onMouseLeave={hideTooltip}
            className={`mt-1 flex w-full items-center rounded-2xl border border-white/10 bg-white/4 text-xs font-semibold text-sand/90 transition hover:border-sand/30 hover:bg-white/10 hover:text-white ${
              collapsed ? "justify-center p-2.5" : "justify-between px-3.5 py-2"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-expanded={!collapsed}
          >
            {!collapsed && <span>Minimize Sidebar</span>}
            <Icon
              name="chevron"
              size={15}
              className={`transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`}
            />
          </button>
        )}
      </div>

      {collapsed && tooltip && (
        <div
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/15 bg-navy/95 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(11,32,55,0.45)] backdrop-blur-md"
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("pssa_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [unread, setUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("pssa_admin_authed") === "true";
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const ambient = useMemo(() => getAmbientProfile(location.pathname), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("pssa_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    api<{ user: { id: string; role: string } | null }>("/auth/me")
      .then((res) => {
        if (!active) return;
        if (!res.user || res.user.role !== "ADMIN") {
          try {
            sessionStorage.removeItem("pssa_admin_authed");
          } catch {
            // ignore
          }
          navigate("/login", { replace: true });
          return;
        }
        try {
          sessionStorage.setItem("pssa_admin_authed", "true");
        } catch {
          // ignore
        }
        setAuthChecked(true);
        adminApi.prefetchCore();
        void adminApi
          .listNotifications()
          .then((items) => {
            if (active) setUnread(items.filter((i) => !i.read).length);
          })
          .catch(() => {});
      })
      .catch(() => {
        try {
          sessionStorage.removeItem("pssa_admin_authed");
        } catch {
          // ignore
        }
        if (active) navigate("/login", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(2);
    const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(2);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    });
  };

  return (
    <div
      ref={canvasRef}
      onMouseMove={handlePointerMove}
      className="admin-ambient-canvas min-h-screen text-ink lg:flex"
      style={
        {
          "--aura-primary": ambient.primary,
          "--aura-secondary": ambient.secondary,
          "--aura-tertiary": ambient.tertiary,
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src="/images/forest-river-bg.jpg"
          alt=""
          className="h-full w-full object-cover object-center opacity-85 saturate-[1.02] contrast-[1.02]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(243, 246, 247, 0.56) 0%, rgba(244, 247, 248, 0.30) 42%, rgba(239, 230, 212, 0.34) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 85% 15%, rgba(24, 162, 105, 0.06) 0%, transparent 55%), radial-gradient(circle at 15% 90%, rgba(11, 32, 55, 0.08) 0%, transparent 55%)",
          }}
        />
      </div>

      <div className="admin-ambient-glow pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="admin-ambient-grid pointer-events-none fixed inset-0 z-0 opacity-35" aria-hidden="true" />
      <div
        className="admin-ambient-orb pointer-events-none fixed -top-24 right-[-6%] z-0 h-[420px] w-[420px] rounded-full opacity-45 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(239, 230, 212, 0.9) 0%, rgba(24, 162, 105, 0.14) 55%, transparent 75%)" }}
        aria-hidden="true"
      />
      <div
        className="admin-ambient-orb pointer-events-none fixed bottom-[-120px] left-[22%] z-0 h-[380px] w-[380px] rounded-full opacity-35 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(24, 162, 105, 0.22) 0%, rgba(11, 32, 55, 0.08) 60%, transparent 80%)",
          animationDelay: "-6s",
        }}
        aria-hidden="true"
      />

      <aside
        className={`relative z-20 hidden shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
          collapsed ? "w-[100px]" : "w-[284px]"
        }`}
      >
        <div className="sticky top-0 h-screen p-3.5 pr-0">
          <div className="relative h-full rounded-[26px] shadow-[0_22px_50px_-14px_rgba(11,32,55,0.38)]">
            <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              className="absolute top-12 -right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-navy shadow-md transition-all duration-200 hover:scale-110 hover:border-green hover:text-green-dark"
            >
              <Icon
                name="chevron"
                size={13}
                className={`transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`}
              />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-[276px] max-w-[84vw] shadow-2xl">
            <SidebarContent isMobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 px-4 pt-3.5 sm:px-8">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/50 bg-white/40 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(11,32,55,0.08)] backdrop-blur-md sm:px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-white/60 bg-white/55 p-2 text-navy transition hover:bg-white/80 lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" size={18} />
              </button>
              <div className="lg:hidden">
                <Wordmark tone="dark" compact />
              </div>

              <div className="hidden items-center gap-2.5 lg:flex">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy/70">{ambient.label}</span>
                <span className="text-navy/25">/</span>
                <span className="rounded-full border border-white/60 bg-white/55 px-2.5 py-0.5 text-xs font-semibold text-navy shadow-2xs">
                  {ambient.section}
                </span>
              </div>

              <span className="hidden items-center gap-1.5 rounded-full border border-green/25 bg-green-soft/75 px-3 py-1 text-[11px] font-semibold text-green-dark sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                Live API
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/admin/notifications"
                className="relative rounded-xl border border-white/60 bg-white/55 p-2.5 text-navy shadow-2xs transition hover:-translate-y-0.5 hover:border-green/40 hover:bg-white/80"
                aria-label="Notifications"
              >
                <Icon name="bell" size={17} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-white shadow-xs">
                    {unread}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/60 bg-white/55 px-3 py-1.5 shadow-2xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-3 font-display text-xs font-bold text-sand ring-2 ring-sand/60">
                  PA
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-xs font-bold text-navy">PSASA Admin</p>
                  <p className="text-[11px] text-muted">Concierge &amp; Compliance</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-main-content mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-7">
          {authChecked ? (
            <div key={location.pathname} className="admin-page-enter">
              <Outlet />
            </div>
          ) : (
            <div className="h-48 animate-pulse rounded-3xl bg-white/60" />
          )}
        </main>
      </div>
    </div>
  );
}
