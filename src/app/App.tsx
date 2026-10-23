import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  clearAuth,
  apiRequest,
  restoreSession,
  setUnauthorizedHandler,
} from "@/shared/lib/apiClient";
import { ApiError, formatApiError } from "@/api/errors";
import type { CurrentUser } from "@/api/contracts";
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
  isMockMode,
  type DemoRole,
} from "@/mocks/auth";
import { resetDemoData } from "@/mocks/store";
import { clearRememberedSessions } from "@/features/lecturer/liveSessionStorage";
import { formatInitials } from "@/shared/lib/format";
import {
  getAcademicLevel,
  getDepartmentId,
  getWorkspaceRole,
} from "@/app/identity";
import "@/app/app.css";

const LecturerTeaching = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.Teaching,
  })),
);
const LecturerStartSession = lazy(() =>
  import("@/features/lecturer/pages").then((module) => ({
    default: module.StartSession,
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
const AdminSignupRequestReview = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.SignupRequestReview,
  })),
);
const AdminVenueAdministration = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.VenueAdministration,
  })),
);
const AdminAcademicCalendar = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.AcademicCalendar,
  })),
);
const AdminRoleAssignment = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.RoleAssignment,
  })),
);
const AdminCoursesAndOfferings = lazy(() =>
  import("@/features/admin/pages").then((module) => ({
    default: module.CoursesAndOfferings,
  })),
);

function RoleGuard({
  role,
  allowedRoles,
  children,
}: {
  role: DemoRole | null;
  allowedRoles: readonly DemoRole[];
  children: React.ReactNode;
}) {
  return role && allowedRoles.includes(role) ? (
    children
  ) : (
    <Navigate to={role ? "/403" : "/login"} replace />
  );
}

function AccessDenied({ home }: { home: string }) {
  return (
    <div className="page-stack">
      <SimplePage
        title="You don't have access to this page"
        subtitle="Your account doesn't have permission to view this workspace."
        icon="profile"
      />
      <Link className="button primary-button access-home-button" to={home}>
        Go to your home
      </Link>
    </div>
  );
}

function UserProfilePage({
  user,
  role,
}: {
  user: CurrentUser;
  role: DemoRole;
}) {
  const departmentId = getDepartmentId(user);
  const level = getAcademicLevel(user);
  const roleLabel = user.roles.some(({ role: assignedRole }) =>
    ["faculty_admin", "department_admin"].includes(assignedRole),
  )
    ? user.roles.some(({ role: assignedRole }) => assignedRole === "faculty_admin")
      ? DEMO_ROLE_LABELS["faculty-admin"]
      : DEMO_ROLE_LABELS["department-admin"]
    : DEMO_ROLE_LABELS[role];
  return (
    <div className="page-stack">
      <SimplePage
        title={user.name}
        subtitle={user.email}
        icon="profile"
      />
      <section className="panel account-profile" aria-label="Profile details">
        <h2>Account details</h2>
        <dl>
          <div>
            <dt>Full name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel}</dd>
          </div>
          <div>
            <dt>Department ID</dt>
            <dd>{departmentId ?? "Not provided by the API"}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{level === undefined ? "Not provided by the API" : level}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

const authPaths = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/change-password",
];

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
  const [role, setRole] = useState<DemoRole | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileError, setProfileError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const initialRoute = useRef(location.pathname);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  const loadCurrentUser = useCallback(async () => {
    const user = await apiRequest<CurrentUser>("/me");
    const workspaceRole = getWorkspaceRole(user);
    if (!workspaceRole)
      throw new Error("Your account has no supported CampusCheck role.");
    setCurrentUser(user);
    setRole(workspaceRole);
    return workspaceRole;
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const restored = await restoreSession();
        if (cancelled) return;
        if (!restored) {
          if (!authPaths.includes(initialRoute.current))
            navigateRef.current("/login", {
              replace: true,
              state: { from: initialRoute.current },
            });
          return;
        }
        const workspaceRole = await loadCurrentUser();
        if (
          !cancelled &&
          (initialRoute.current === "/" || initialRoute.current === "/login")
        ) {
          navigateRef.current(DEMO_ROLE_ROUTES[workspaceRole], {
            replace: true,
          });
        }
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 401)
          setProfileError(formatApiError(caught));
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser, mockMode]);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCurrentUser(null);
      setRole(null);
      setProfileError("");
      navigate("/login", {
        replace: true,
        state: { from: location.pathname },
      });
    });
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
  const isAuth = authPaths.includes(activePath);
  if (!authReady) return <Splash />;
  if (profileError && (!isAuth || activePath === "/login"))
    return (
      <main className="identity-error-screen">
        <div className="panel" role="alert">
          <h1>Could not load your account</h1>
          <p>{profileError}</p>
          <button
            className="button primary-button"
            onClick={() => {
              setAuthReady(false);
              setProfileError("");
              void loadCurrentUser()
                .then((workspaceRole) => {
                  if (initialRoute.current === "/")
                    navigate(DEMO_ROLE_ROUTES[workspaceRole], {
                      replace: true,
                    });
                })
                .catch((caught: unknown) =>
                  setProfileError(formatApiError(caught)),
                )
                .finally(() => setAuthReady(true));
            }}
          >
            Retry
          </button>
          <button
            className="text-button"
            onClick={() => {
              setCurrentUser(null);
              setRole(null);
              setProfileError("");
              clearAuth();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  if (isAuth && activePath !== "/login") {
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
  if (role === null || currentUser === null)
    return (
      <Login
        onLogin={async () => {
          setAuthReady(false);
          try {
            const workspaceRole = await loadCurrentUser();
            navigate(DEMO_ROLE_ROUTES[workspaceRole], { replace: true });
          } finally {
            setAuthReady(true);
          }
        }}
        onResetDemo={() => {
          clearMockSession();
          if (currentUser) clearRememberedSessions(currentUser.id);
          resetDemoData();
          clearAuth();
          navigate("/login", { replace: true });
        }}
      />
    );
  if (activePath === "/login")
    return <Navigate to={DEMO_ROLE_ROUTES[role]} replace />;
  return (
    <div className="app-shell" data-role={role}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <Link
          to={DEMO_ROLE_ROUTES[role]}
          className="brand"
          aria-label="CampusCheck home"
        >
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
                label="Import staff"
                path="/admin/import"
                icon="import"
                current={activePath}
              />
              <NavLink
                label="Signup requests"
                path="/admin/signup-requests"
                icon="users"
                current={activePath}
              />
              <NavLink
                label="Venues"
                path="/admin/venues"
                icon="home"
                current={activePath}
              />
              <NavLink
                label="Academic calendar"
                path="/admin/academic-calendar"
                icon="calendar"
                current={activePath}
              />
              <NavLink
                label="Administrator roles"
                path="/admin/roles"
                icon="profile"
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
              }
              setCurrentUser(null);
              setRole(null);
              clearAuth();
              navigate("/login");
            }}
          >
            <span className="avatar">{formatInitials(currentUser.name)}</span>
            <span className="user-meta">
              <b>{currentUser.name}</b>
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
                onClick={() => {
                  if (role === "lecturer")
                    clearRememberedSessions(currentUser.id);
                  resetDemoData();
                }}
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
            <div className="topbar-identity" aria-label="Signed-in user">
              <b>{currentUser.name}</b>
              <small>
                {currentUser.email}
                {" · "}
                {getAcademicLevel(currentUser) === undefined
                  ? "Level not provided"
                  : `Level ${getAcademicLevel(currentUser)}`}
              </small>
            </div>
            <span className="top-avatar">
              {formatInitials(currentUser.name)}
            </span>
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
              <Route
                path="/"
                element={
                  role === "student" ? (
                    <Dashboard />
                  ) : (
                    <Navigate to={DEMO_ROLE_ROUTES[role]} replace />
                  )
                }
              />
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
                  <RoleGuard role={role} allowedRoles={["student"]}>
                    <CheckIn onResult={setNotice} online={online} />
                  </RoleGuard>
                }
              />
              <Route
                path="/find-classes"
                element={
                  <RoleGuard role={role} allowedRoles={["student"]}>
                    <FindClasses />
                  </RoleGuard>
                }
              />
              <Route
                path="/courses"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={[
                      "student",
                      "department-admin",
                      "institution-admin",
                    ]}
                  >
                    {role === "student" ? (
                      <Courses />
                    ) : (
                      <AdminCoursesAndOfferings user={currentUser} />
                    )}
                  </RoleGuard>
                }
              />
              <Route
                path="/history"
                element={
                  <RoleGuard role={role} allowedRoles={["student"]}>
                    <History />
                  </RoleGuard>
                }
              />
              <Route
                path="/disputes"
                element={
                  <RoleGuard role={role} allowedRoles={["student"]}>
                    <SimplePage
                      title="Attendance disputes"
                      subtitle="Ask us to review an attendance record."
                      icon="dispute"
                    />
                  </RoleGuard>
                }
              />
              <Route
                path="/profile"
                element={<UserProfilePage user={currentUser} role={role} />}
              />
              <Route
                path="/lecturer"
                element={
                  <RoleGuard role={role} allowedRoles={["lecturer"]}>
                    <LecturerTeaching user={currentUser} />
                  </RoleGuard>
                }
              />
              <Route
                path="/lecturer/start"
                element={
                  <RoleGuard role={role} allowedRoles={["lecturer"]}>
                    <LecturerStartSession user={currentUser} />
                  </RoleGuard>
                }
              />
              <Route
                path="/lecturer/live"
                element={
                  <RoleGuard role={role} allowedRoles={["lecturer"]}>
                    <LecturerLiveSession user={currentUser} />
                  </RoleGuard>
                }
              />
              <Route
                path="/lecturer/report"
                element={
                  <RoleGuard role={role} allowedRoles={["lecturer"]}>
                    <LecturerReport user={currentUser} />
                  </RoleGuard>
                }
              />
              <Route
                path="/lecturer/print-sheet"
                element={
                  <RoleGuard role={role} allowedRoles={["lecturer"]}>
                    <LecturerPrintSheet />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin"
                element={
                  <RoleGuard role={role} allowedRoles={["department-admin"]}>
                    <SimplePage
                      title="Department dashboard"
                      subtitle="A clear view of attendance across your department."
                      icon="report"
                    />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/institution"
                element={
                  <RoleGuard role={role} allowedRoles={["institution-admin"]}>
                    <SimplePage
                      title="Institution dashboard"
                      subtitle="Institution-wide attendance, offerings and academic operations."
                      icon="report"
                    />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/import"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={["department-admin", "institution-admin"]}
                  >
                    <AdminImportStudents />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/signup-requests"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={["department-admin", "institution-admin"]}
                  >
                    <AdminSignupRequestReview />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/venues"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={["department-admin", "institution-admin"]}
                  >
                    <AdminVenueAdministration />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/academic-calendar"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={["department-admin", "institution-admin"]}
                  >
                    <AdminAcademicCalendar />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <RoleGuard
                    role={role}
                    allowedRoles={["department-admin", "institution-admin"]}
                  >
                    <AdminRoleAssignment />
                  </RoleGuard>
                }
              />
              <Route
                path="/403"
                element={
                  <AccessDenied home={DEMO_ROLE_ROUTES[role]} />
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
