// Admins can edit and delete any project. Shared by Convex functions and the UI.
export const ADMIN_EMAILS = ['wangttiffany@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
