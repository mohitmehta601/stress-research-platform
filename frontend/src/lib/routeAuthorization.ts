export const dashboardRoles = new Set([
  "viewer",
  "researcher",
  "doctor",
  "admin",
  "super_admin",
]);

export function canAccessDashboard(role?: string | null) {
  if (!role) return false;
  return dashboardRoles.has(role.toLowerCase());
}
