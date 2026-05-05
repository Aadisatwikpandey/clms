import NextAuth from "next-auth";
import { authConfig } from "./config";

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

export type UserRole = "admin" | "librarian" | "staff" | "member" | "finance" | "readonly";

export function hasRole(userRole: string | undefined, ...allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as UserRole);
}

export function canManageCatalogue(role: string) {
  return hasRole(role, "admin", "librarian", "staff");
}

export function canManageCirculation(role: string) {
  return hasRole(role, "admin", "librarian", "staff");
}

export function canManageFinance(role: string) {
  return hasRole(role, "admin", "finance");
}

export function canManageAdmin(role: string) {
  return hasRole(role, "admin");
}
