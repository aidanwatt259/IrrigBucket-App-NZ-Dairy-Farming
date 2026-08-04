import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import {
  supabase,
  respondSupabaseError,
  respondIfUnavailable,
} from "../lib/supabase.js";
import { isAdmin } from "./reports.js";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

async function fetchUsers(userIds: (string | null)[]) {
  const ids = userIds.filter((id): id is string => id !== null);
  if (ids.length === 0) return new Map<string, { email: string | null; firstName: string | null; lastName: string | null }>();
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
  }).from(usersTable).where(inArray(usersTable.id, ids));
  return new Map(users.map((u) => [u.id, u]));
}

router.get("/admin/reports", requireAdmin, async (_req, res) => {
  const { data: rows, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    respondSupabaseError(res, error, "Supabase error:", {
      status: 500,
      error: "Failed to fetch reports",
    });
    return;
  }

  const usersMap = await fetchUsers((rows ?? []).map((r) => r.user_id));

  res.json({
    reports: (rows ?? []).map((r) => {
      const user = r.user_id ? usersMap.get(r.user_id) : null;
      return {
        id: r.id,
        userId: r.user_id,
        irrigatorType: r.irrigator_type,
        farmName: r.farm_name,
        assessorName: r.assessor_name,
        testDate: r.test_date,
        duPercent: r.du_percent,
        duStatus: r.du_status,
        reportData: r.report_data,
        createdAt: r.created_at,
        updatedAt: r.updated_at ?? null,
        clientUpdatedAt: r.client_updated_at ?? null,
        deletedAt: r.deleted_at ?? null,
        userEmail: user?.email ?? null,
        userName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null : null,
      };
    }),
  });
});

router.get("/admin/help-requests", requireAdmin, async (_req, res) => {
  const { data: rows, error } = await supabase
    .from("help_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    respondSupabaseError(res, error, "Supabase error:", {
      status: 500,
      error: "Failed to fetch help requests",
    });
    return;
  }

  const usersMap = await fetchUsers((rows ?? []).map((r) => r.user_id));

  res.json({
    helpRequests: (rows ?? []).map((r) => {
      const user = r.user_id ? usersMap.get(r.user_id) : null;
      return {
        id: r.id,
        userId: r.user_id,
        description: r.description,
        contactInfo: r.contact_info,
        resolved: r.resolved,
        createdAt: r.created_at,
        userEmail: user?.email ?? null,
        userName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null : null,
      };
    }),
  });
});

router.patch<{ id: string }>("/admin/help-requests/:id/resolve", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: updated, error } = await supabase
    .from("help_requests")
    .update({ resolved: true })
    .eq("id", id)
    .select()
    .single();

  if (error || !updated) {
    if (respondIfUnavailable(res, error)) return;
    res.status(404).json({ error: "Help request not found" });
    return;
  }

  res.json({
    helpRequest: {
      id: updated.id,
      userId: updated.user_id,
      description: updated.description,
      contactInfo: updated.contact_info,
      resolved: updated.resolved,
      createdAt: updated.created_at,
      userEmail: null,
      userName: null,
    },
  });
});

router.get("/admin/feedback", requireAdmin, async (_req, res) => {
  const { data: rows, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    respondSupabaseError(res, error, "Supabase error:", {
      status: 500,
      error: "Failed to fetch feedback",
    });
    return;
  }

  const usersMap = await fetchUsers((rows ?? []).map((r) => r.user_id));

  res.json({
    feedback: (rows ?? []).map((r) => {
      const user = r.user_id ? usersMap.get(r.user_id) : null;
      return {
        id: r.id,
        userId: r.user_id,
        message: r.message,
        contactInfo: r.contact_info,
        createdAt: r.created_at,
        userEmail: user?.email ?? null,
        userName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null : null,
      };
    }),
  });
});

export default router;
