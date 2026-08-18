import type { Request } from "express";

export function isAdmin(req: Request): boolean {
  if (!req.user) return false;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId && process.env.NODE_ENV !== "production") return true;
  return req.user.id === adminId;
}
