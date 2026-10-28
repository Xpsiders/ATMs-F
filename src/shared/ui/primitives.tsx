import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AttendanceOverrideRequest } from "@/api/contracts";

export type IconName =
  | "home"
  | "search"
  | "courses"
  | "history"
  | "dispute"
  | "profile"
  | "book"
  | "calendar"
  | "users"
  | "report"
  | "import"
  | "settings"
  | "moon"
  | "bell"
  | "logout"
  | "pin"
  | "clock"
  | "check"
  | "arrow"
  | "spark"
  | "menu";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    courses: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5m4-1v5l3 2" />
      </>
    ),
    dispute: (
      <>
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 9v4m0 3h.01" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    report: (
      <>
        <path d="M4 19V5m0 14h17" />
        <path d="m7 15 4-4 3 2 5-6" />
      </>
    ),
    import: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 17v4h14v-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7 15a8 8 0 0 1 0-2l-.1-.1-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4L19 13a8 8 0 0 1 .4 2Z" />
      </>
    ),
    moon: (
      <>
        <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5m5 5H3" />
        <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4 10-10" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
  };
  return (
    <svg
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

export const NAV = [
  { label: "Overview", path: "/", icon: "home" as const },
  { label: "Find classes", path: "/find-classes", icon: "search" as const },
  { label: "My courses", path: "/courses", icon: "courses" as const },
  { label: "Attendance", path: "/history", icon: "history" as const },
  { label: "Disputes", path: "/disputes", icon: "dispute" as const },
];

export const CHECKIN_ERRORS = [
  "wrong_code",
  "code_expired",
  "session_closed",
  "not_on_roster",
  "already_checked_in",
  "accuracy_too_poor",
  "device_already_used",
  "location_too_inaccurate",
  "too_many_attempts",
  "device_not_bound",
  "code_locked",
  "account_temporarily_locked",
  "no_active_session",
  "rate_limited",
  "device_key_revoked",
  "token_reuse_detected",
  "lecturer_has_open_session",
  "venue_has_open_session",
];

export const OVERRIDE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
] as const satisfies readonly AttendanceOverrideRequest["status"][];

export const OVERRIDE_REASONS = [
  "power_outage",
  "device_failure",
  "official_duty",
  "medical",
  "other",
] as const satisfies readonly AttendanceOverrideRequest["reason_code"][];

export function isOverrideStatus(
  value: string,
): value is AttendanceOverrideRequest["status"] {
  return OVERRIDE_STATUSES.some((status) => status === value);
}

export function isOverrideReason(
  value: string,
): value is AttendanceOverrideRequest["reason_code"] {
  return OVERRIDE_REASONS.some((reason) => reason === value);
}

export function NavLink({
  label,
  path,
  icon,
  current,
}: {
  label: string;
  path: string;
  icon: IconName;
  current: string;
}) {
  return (
    <Link
      to={path}
      className={`nav-link ${path === current ? "active" : ""}`}
      aria-current={path === current ? "page" : undefined}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
      {label === "Disputes" && <span className="nav-count">1</span>}
    </Link>
  );
}

export function Splash() {
  return (
    <main className="branded-splash" role="status" aria-live="polite">
      <div className="brand-mark">
        <Icon name="check" size={20} />
      </div>
      <strong>
        Campus<span>Check</span>
      </strong>
      <p>Getting your campus ready…</p>
    </main>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function SimplePage({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
}) {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CAMPUS ATTENDANCE"
        title={title}
        subtitle={subtitle}
      />
      <section className="panel empty-panel">
        <div className="empty-illustration">
          <Icon name={icon} size={30} />
        </div>
        <h2>Everything in one place</h2>
        <p>
          This workspace is ready for your campus data. Check back here as your
          semester unfolds.
        </p>
        <Link className="button primary-button" to="/">
          Back to overview <Icon name="arrow" size={16} />
        </Link>
      </section>
    </div>
  );
}
