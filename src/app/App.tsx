import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  clearAuth,
  restoreSession,
  setUnauthorizedHandler,
} from "@/shared/lib/apiClient";
import { Icon, NAV, NavLink, SimplePage, Splash } from "@/shared/ui/primitives";
import { AuthFlow, Login } from "@/features/auth/pages";
import {
  Dashboard,
  CheckIn,
  FindClasses,
  Courses,
  History,
} from "@/features/student/pages";
import {
  clearMockSession,
  DEMO_ROLE_LABELS,
  DEMO_ROLE_ROUTES,
  getMockSession,
  isMockMode,
  type DemoRole,
} from "@/mocks/auth";
import { resetDemoData } from "@/mocks/store";
import "@/app/app.css";

const LecturerTeaching = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.Teaching,
  })),
);
const LecturerLiveSession = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.LiveSession,
  })),
);
const LecturerReport = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.Report,
  })),
);
const LecturerPrintSheet = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.PrintSheet,
  })),
);
const AdminImportStudents = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.ImportStudents,
  })),
);

export function App() {
  const mockMode = isMockMode();
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(() => {
    try {
      const saved = localStorage.getItem("campuscheck-theme");
      return saved === "light" || saved === "dark" ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  const [role, setRole] = useState<DemoRole>(
    () => getMockSession()?.role ?? "student",
  );
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();
  const initialRoute = useRef(location.pathname);
  useEffect(() => {
    if (
      [
        "/login",
        "/signup",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/change-password",
      ].includes(initialRoute.current)
    ) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    void restoreSession()
      .then((restored) => {
        if (cancelled) return;
        if (!restored) {
          navigate("/login", {
            replace: true,
            state: { from: initialRoute.current },
          });
          return;
        }
        const session = getMockSession();
        if (session) setRole(session.role);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mockMode, navigate]);
  useEffect(() => {
    setUnauthorizedHandler(() =>
      navigate("/login", {
        replace: true,
        state: { from: location.pathname },
      }),
    );
    return () => setUnauthorizedHandler(undefined);
  }, [location.pathname, navigate]);
  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("campuscheck-theme", theme);
    } catch {
      /* Theme remains usable for this visit. */
    }
  }, [theme]);
  useEffect(() => {
    setMobileMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const activePath = location.pathname;
  const pageName = useMemo(() => {
    const found = NAV.find((item) => item.path === activePath);
    return (
      found?.label ??
      (
        {
          "/check-in": "Check in",
          "/lecturer": "Teaching",
          "/lecturer/live": "Live session",
          "/lecturer/report": "Session report",
          "/admin": "Administration",
          "/admin/import": "Import students",
          "/profile": "My profile",
          "/login": "Welcome back",
          "/signup": "Claim your account",
          "/verify-email": "Verify your email",
          "/forgot-password": "Reset your password",
          "/reset-password": "Choose a new password",
          "/change-password": "Change your password",
        } as Record<string, string>
      )[activePath] ??
      "Campus Attendance"
    );
  }, [activePath]);
  const authPaths = [
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/change-password",
  ];
  const isAuth = authPaths.includes(activePath);
  if (!authReady) return <Splash />;
  if (activePath === "/login")
    return (
      <Login
        onLogin={(accountRole = "student") => {
          const state = location.state;
          const intended =
            typeof state === "object" &&
            state !== null &&
            "from" in state &&
            typeof state.from === "string"
              ? state.from
              : "/";
          const activeRole = getMockSession()?.role ?? accountRole;
          setRole(activeRole);
          navigate(mockMode ? DEMO_ROLE_ROUTES[activeRole] : intended, {
            replace: true,
          });
        }}
        onResetDemo={() => {
          clearMockSession();
          resetDemoData();
          clearAuth();
          navigate("/login", { replace: true });
        }}
      />
    );
  if (isAuth) {
    const type =
      activePath === "/signup"
        ? "signup"
        : activePath === "/verify-email"
          ? "verify"
          : activePath === "/forgot-password"
            ? "forgot"
            : activePath === "/reset-password"
              ? "reset"
              : "change";
    return <AuthFlow type={type} />;
  }
  return (
    <div className="app-shell" data-role={role}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <Link to="/" className="brand" aria-label="CampusCheck home">
          <span className="brand-mark">
            <Icon name="check" size={20} />
          </span>
          <span className="brand-copy">
            <strong>
              Campus<span>Check</span>
            </strong>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <label className="role-select-label" htmlFor="role-select">
          Your workspace
        </label>
        <select
          id="role-select"
          className="role-select"
          value={role}
          onChange={(event) => {
            const value = event.target.value;
            if (value in DEMO_ROLE_LABELS) setRole(value as DemoRole);
          }}
        >
          {Object.entries(DEMO_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-section">YOUR CAMPUS</span>
          {role === "student" ? (
            NAV.map((item) => (
              <NavLink key={item.path} {...item} current={activePath} />
            ))
          ) : role === "lecturer" ? (
            <>
              <NavLink
                label="My teaching"
                path="/lecturer"
                icon="book"
                current={activePath}
              />
              <NavLink
                label="Live session"
                path="/lecturer/live"
                icon="calendar"
                current={activePath}
              />
              <NavLink
                label="Session reports"
                path="/lecturer/report"
                icon="report"
                current={activePath}
              />
            </>
          ) : (
            <>
              <NavLink
                label="Dashboard"
                path={
                  role === "department-admin" ? "/admin" : "/admin/institution"
                }
                icon="home"
                current={activePath}
              />
              <NavLink
                label="Import students"
                path="/admin/import"
                icon="import"
                current={activePath}
              />
              <NavLink
                label="Courses & offerings"
                path="/courses"
                icon="courses"
                current={activePath}
              />
              <NavLink
                label="People & roles"
                path="/profile"
                icon="users"
                current={activePath}
              />
            </>
          )}
          <span className="nav-section nav-section-lower">ACCOUNT</span>
          <NavLink
            label="My profile"
            path="/profile"
            icon="profile"
            current={activePath}
          />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <Icon name="spark" size={17} />
            </div>
            <strong>Need a hand?</strong>
            <span>We're here to help you stay on track.</span>
            <button
              onClick={() =>
                setNotice("Student support: support@campus.example")
              }
            >
              Get support <Icon name="arrow" size={14} />
            </button>
          </div>
          <button
            className="user-chip"
            aria-label="Log out"
            onClick={() => {
              if (mockMode) {
                clearMockSession();
                resetDemoData();
              }
              clearAuth();
              navigate("/login");
            }}
          >
            <span className="avatar">AO</span>
            <span className="user-meta">
              <b>{getMockSession()?.name ?? "Amara Okafor"}</b>
              <small>{DEMO_ROLE_LABELS[role]}</small>
            </span>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          aria-label="Close menu"
          className="mobile-shade"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <section className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open menu"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <b>{pageName}</b>
          </div>
          {role === "student" && (
            <Link
              to="/"
              className="desktop-brand"
              aria-label="CampusCheck home"
            >
              <span className="brand-mark">
                <Icon name="check" size={18} />
              </span>
              <span>Campus</span>
              <span>Check</span>
            </Link>
          )}
          {role === "student" && (
            <nav
              className="desktop-student-nav"
              aria-label="Student navigation"
            >
              {NAV.slice(0, 4).map((item) => (
                <NavLink key={item.path} {...item} current={activePath} />
              ))}
            </nav>
          )}
          <div className="topbar-actions">
            <div className="term-pill">
              <span className="term-dot" />
              2024 / 2025 <span className="term-separator">·</span> Semester 2
            </div>
            {mockMode && (
              <button
                className="text-button demo-reset-topbar"
                onClick={resetDemoData}
              >
                Reset demo data
              </button>
            )}
            <label className="theme-select-label" htmlFor="theme-select">
              Colour theme
            </label>
            <select
              id="theme-select"
              className="theme-select"
              aria-label="Colour theme"
              value={theme}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "auto" || value === "light" || value === "dark")
                  setTheme(value);
              }}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <button
              className="icon-button theme-quick-toggle"
              aria-label="Toggle dark mode"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "spark" : "moon"} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotice("You're all caught up.")}
            >
              <Icon name="bell" />
              <span />
            </button>
            <span className="top-avatar">AO</span>
          </div>
        </header>
        <div
          className={`offline-banner ${online ? "" : "offline"}`}
          role="status"
        >
          <span className="online-dot" />{" "}
          {online
            ? "You're online · Changes sync automatically"
            : "You're offline · Some features are unavailable"}
        </div>
        {notice && (
          <button className="toast" onClick={() => setNotice("")} role="status">
            {notice}
            <span aria-hidden="true"> ×</span>
          </button>
        )}
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/signup" element={<AuthFlow type="signup" />} />
              <Route
                path="/verify-email"
                element={<AuthFlow type="verify" />}
              />
              <Route
                path="/forgot-password"
                element={<AuthFlow type="forgot" />}
              />
              <Route
                path="/reset-password"
                element={<AuthFlow type="reset" />}
              />
              <Route
                path="/change-password"
                element={<AuthFlow type="change" />}
              />
              <Route
                path="/check-in"
                element={
                  <CheckIn onResult={setNotice} online={online} />
                }
              />
              <Route path="/find-classes" element={<FindClasses />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/history" element={<History />} />
              <Route
                path="/disputes"
                element={
                  <SimplePage
                    title="Attendance disputes"
                    subtitle="Ask us to review an attendance record."
                    icon="dispute"
                  />
                }
              />
              <Route
                path="/profile"
                element={
                  <SimplePage
                    title="My profile"
                    subtitle="Your details are managed by your department."
                    icon="profile"
                  />
                }
              />
              <Route path="/lecturer" element={<LecturerTeaching />} />
              <Route path="/lecturer/live" element={<LecturerLiveSession />} />
              <Route path="/lecturer/report" element={<LecturerReport />} />
              <Route
                path="/lecturer/print-sheet"
                element={<LecturerPrintSheet />}
              />
              <Route
                path="/admin"
                element={
                  <SimplePage
                    title="Department dashboard"
                    subtitle="A clear view of attendance across your department."
                    icon="report"
                  />
                }
              />
              <Route
                path="/admin/institution"
                element={
                  <SimplePage
                    title="Institution dashboard"
                    subtitle="Institution-wide attendance, offerings and academic operations."
                    icon="report"
                  />
                }
              />
              <Route path="/admin/import" element={<AdminImportStudents />} />
              <Route
                path="/403"
                element={
                  <SimplePage
                    title="You don't have access to this page"
                    subtitle="Your account doesn't have permission to view this workspace."
                    icon="profile"
                  />
                }
              />
              <Route
                path="*"
                element={
                  <SimplePage
                    title="We couldn't find that page"
                    subtitle="It may have moved, or the link may be out of date."
                    icon="search"
                  />
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>© 2025 Campus Attendance</span>
          <span>
            Built for better learning <span className="footer-heart">✳</span>
          </span>
        </footer>
      </section>
      {role === "student" && (
        <nav className="mobile-tabs" aria-label="Student navigation">
          {NAV.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                item.path === activePath ? "mobile-tab active" : "mobile-tab"
              }
              aria-current={item.path === activePath ? "page" : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>
                {item.label === "Overview"
                  ? "Home"
                  : item.label === "Attendance"
                    ? "History"
                    : item.label.replace("My ", "")}
              </span>
            </Link>
          ))}
          <Link
            to="/profile"
            className="mobile-tab"
            aria-current={activePath === "/profile" ? "page" : undefined}
          >
            <Icon name="profile" size={19} />
            <span>Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
