import type { CurrentUser } from "@/api/contracts";
import type { DemoRole } from "@/mocks/auth";

export function getWorkspaceRole(user: CurrentUser): DemoRole | null {
  const roles = user.roles.map(({ role }) => role);
  if (roles.includes("institution_admin") || roles.includes("platform_admin"))
    return "institution-admin";
  if (roles.includes("department_admin") || roles.includes("faculty_admin"))
    return "department-admin";
  if (roles.includes("lecturer")) return "lecturer";
  if (roles.includes("student")) return "student";
  return null;
}

export function getDepartmentId(user: CurrentUser): string | undefined {
  const departmentRole = user.roles.find(
    (role) => role.department_id || role.scope_type === "department",
  );
  return departmentRole?.department_id ?? departmentRole?.scope_id ?? undefined;
}

export function getAcademicLevel(user: CurrentUser): number | undefined {
  return user.roles.find((role) => role.level !== undefined)?.level;
}
