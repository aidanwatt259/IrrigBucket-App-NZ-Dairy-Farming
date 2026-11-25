import { Router, type IRouter, type Request, type Response } from "express";
import {
  supabase,
  respondSupabaseError,
  respondIfUnavailable,
} from "../lib/supabase";
import { isAdmin } from "../lib/admin";
import { getRequestOrigin } from "../lib/origin";
import { generateShareToken, isShareToken, shareUrl } from "../lib/shareTokens";
import { userHasPaidAccess } from "./billing";
import { toReportResponse } from "./reports";
import { loadBusinessProfile } from "./account";

const router: IRouter = Router();

/** Postgres / PostgREST codes meaning `report_shares` doesn't exist yet. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
/** Codes meaning `reports.shared_with_farmer` doesn't exist yet. */
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

const NOT_SET_UP_BODY = {
  error: "Sharing isn't set up on the server yet (run supabase-shares.sql).",
  code: "SHARING_NOT_SET_UP",
} as const;

function errorCode(error: unknown): string {
  return String((error as { code?: unknown })?.code ?? "");
}

function respondShareError(res: Response, error: unknown, label: string, fallback: string): void {
  if (MISSING_TABLE_CODES.has(errorCode(error))) {
    console.error(`${label}: report_shares table missing`, error);
    res.status(503).json(NOT_SET_UP_BODY);
    return;
  }
  respondSupabaseError(res, error, label, { status: 500, error: fallback });
}

/** Load a report the caller may manage, answering 401/404 when they can't. */
async function loadOwnReport(
  req: Request,
  res: Response,
): Promise<{ id: string; user_id: string | null } | null> {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const id = String(req.params.id);
  const { data, error } = await supabase
    .from("reports")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (respondIfUnavailable(res, error)) return null;
    console.error("Error loading report for share:", error);
    res.status(404).json({ error: "Report not found" });
    return null;
  }
  if (!data || data.deleted_at || (data.user_id !== req.user.id && !isAdmin(req))) {
    res.status(404).json({ error: "Report not found" });
    return null;
  }
  return { id: data.id, user_id: data.user_id };
}

async function findLiveShare(reportId: string) {
  const { data, error } = await supabase
    .from("report_shares")
    .select("token, created_at")
    .eq("report_id", reportId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Best-effort flag; tolerated when the column hasn't been added yet. */
async function setSharedFlag(reportId: string, shared: boolean): Promise<void> {
  const { error } = await supabase
    .from("reports")
    .update({ shared_with_farmer: shared })
    .eq("id", reportId);
  if (error && !MISSING_COLUMN_CODES.has(errorCode(error))) {
    console.error("Error updating shared_with_farmer:", error);
  }
}

function toShareLink(req: Request, share: { token: string; created_at: string }) {
  return {
    token: share.token,
    url: shareUrl(getRequestOrigin(req), share.token),
    createdAt: share.created_at,
  };
}

router.get("/reports/:id/share", async (req: Request, res: Response) => {
  const report = await loadOwnReport(req, res);
  if (!report) return;
  try {
    const share = await findLiveShare(report.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ share: share ? toShareLink(req, share) : null });
  } catch (error) {
    respondShareError(res, error, "Error loading share link:", "Failed to load share link");
  }
});

router.post("/reports/:id/share", async (req: Request, res: Response) => {
  const report = await loadOwnReport(req, res);
  if (!report) return;
  if (!(await userHasPaidAccess(req))) {
    res.status(402).json({ error: "A subscription is required to share reports", code: "PAYMENT_REQUIRED" });
    return;
  }
  try {
    let share = await findLiveShare(report.id);
    if (!share) {
      const { data, error } = await supabase
        .from("report_shares")
        .insert({
          token: generateShareToken(),
          report_id: report.id,
          created_by: req.user!.id,
        })
        .select("token, created_at")
        .single();
      if (error) throw error;
      share = data;
    }
    await setSharedFlag(report.id, true);
    res.setHeader("Cache-Control", "no-store");
    res.json({ share: toShareLink(req, share) });
  } catch (error) {
    respondShareError(res, error, "Error creating share link:", "Failed to create share link");
  }
});

router.delete("/reports/:id/share", async (req: Request, res: Response) => {
  const report = await loadOwnReport(req, res);
  if (!report) return;
  try {
    const { error } = await supabase
      .from("report_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("report_id", report.id)
      .is("revoked_at", null);
    if (error) throw error;
    await setSharedFlag(report.id, false);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true });
  } catch (error) {
    respondShareError(res, error, "Error revoking share link:", "Failed to stop sharing");
  }
});

// Public: anyone holding a live token can read (not edit) the report.
router.get("/shared/:token", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const token = String(req.params.token);
  if (!isShareToken(token)) {
    res.status(404).json({ error: "This link isn't valid" });
    return;
  }
  try {
    const { data: share, error: shareError } = await supabase
      .from("report_shares")
      .select("report_id")
      .eq("token", token)
      .is("revoked_at", null)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!share) {
      res.status(404).json({ error: "This report is no longer shared" });
      return;
    }
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", share.report_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!report) {
      res.status(404).json({ error: "This report is no longer available" });
      return;
    }
    let branding = null;
    if (report.user_id) {
      const profile = await loadBusinessProfile(report.user_id);
      if (Object.values(profile).some((v) => v != null)) branding = profile;
    }
    // Never expose the owner's user id on a public page.
    res.json({ report: { ...toReportResponse(report), userId: null }, branding });
  } catch (error) {
    respondShareError(res, error, "Error loading shared report:", "Failed to load shared report");
  }
});

export default router;
