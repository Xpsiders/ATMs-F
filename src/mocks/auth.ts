export type DemoRole =
  | "student"
  | "lecturer"
  | "department-admin"
  | "institution-admin";

export type DemoAccount = {
  email: string;
  password: string;
  role: DemoRole;
  name: string;
};

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  student: "Student",
  lecturer: "Lecturer",
  "department-admin": "Department admin",
  "institution-admin": "Institution admin",
};

export const DEMO_ROLE_ROUTES: Record<DemoRole, string> = {
  student: "/",
  lecturer: "/lecturer",
  "department-admin": "/admin",
  "institution-admin": "/admin/institution",
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: "amara.student@campus.example",
    password: "StudentDemo!2026",
    role: "student",
    name: "Amara Okafor",
  },
  {
    email: "ngozi.lecturer@campus.example",
    password: "LecturerDemo!2026",
    role: "lecturer",
    name: "Dr. Ngozi Eze",
  },
  {
    email: "admin.department@campus.example",
    password: "DepartmentDemo!2026",
    role: "department-admin",
    name: "Department Administrator",
  },
  {
    email: "admin.institution@campus.example",
    password: "InstitutionDemo!2026",
    role: "institution-admin",
    name: "Institution Administrator",
  },
];

const SESSION_KEY = "campuscheck-mock-role";
let activeAccount: DemoAccount | null = null;

export function isMockMode(): boolean {
  return (
    (import.meta.env.DEV || import.meta.env.MODE === "test") &&
    import.meta.env.VITE_USE_MOCKS === "true"
  );
}

export function getMockSession(): DemoAccount | null {
  if (!isMockMode()) return null;
  if (activeAccount) return activeAccount;
  try {
    const role = sessionStorage.getItem(SESSION_KEY);
    activeAccount = DEMO_ACCOUNTS.find((account) => account.role === role) ?? null;
  } catch {
    activeAccount = null;
  }
  return activeAccount;
}

export function startMockSession(role: DemoRole): DemoAccount | null {
  if (!isMockMode()) return null;
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === role);
  if (!account) return null;
  activeAccount = account;
  try {
    sessionStorage.setItem(SESSION_KEY, account.role);
  } catch {
    // The current-page session remains usable if sessionStorage is unavailable.
  }
  return account;
}

export function startMockSessionWithCredentials(
  email: string,
  password: string,
): DemoAccount | null {
  const account = DEMO_ACCOUNTS.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.trim().toLowerCase() &&
      candidate.password === password,
  );
  return account ? startMockSession(account.role) : null;
}

export function clearMockSession(): void {
  activeAccount = null;
  if (!isMockMode()) return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Clearing the in-memory session remains effective for this page.
  }
}

export function mockRefreshResponse(): Response {
  return new Response(null, { status: getMockSession() ? 204 : 401 });
}
