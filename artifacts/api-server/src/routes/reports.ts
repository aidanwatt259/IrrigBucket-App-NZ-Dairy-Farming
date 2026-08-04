import { Router, type IRouter } from "express";
import { SaveReportBody } from "@workspace/api-zod";
import {
  supabase,
  respondSupabaseError,
  respondIfUnavailable,
} from "../lib/supabase.js";
import { decideReportUpsert } from "../lib/reportUpsert.js";

const router: IRouter = Router();

// Offline-first save: upsert keyed on the client-supplied report id, with
// Last-Write-Wins conflict resolution and per-user ownership enforcement.
// Always responds with the authoritative record (the winner), so the client
// can adopt it directly during sync reconciliation.
router.post("/reports", async (req, res) => {
  const parsed = SaveReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const body = parsed.data;
  const callerId = req.user?.id ?? null;
  const incomingClientUpdatedAt =
    body.clientUpdatedAt ?? new Date().toISOString();

  // Look up an existing row only when the client supplies an id. Legacy
  // clients omit it and always get a fresh insert.
  let existing:
    | {
        user_id: string | null;
        client_updated_at: string | null;
        updated_at: string;
        created_at: string;
      }
    | null = null;

  if (body.id) {
    const { data, error } = await supabase
      .from("reports")
      .select("user_id, client_updated_at, updated_at, created_at")
      .eq("id", body.id)
      .maybeSingle();

    if (error) {
      respondSupabaseError(res, error, "Supabase lookup error:", {
        status: 500,
        error: "Failed to save report",
      });
      return;
    }

    existing = data;
  }

  const decision = decideReportUpsert({
    existing,
    callerId,
    isAdmin: isAdmin(req),
    incomingClientUpdatedAt,
  });

  if (decision.kind === "forbidden") {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  // Server already has a newer-or-equal copy: return it unchanged so the
  // client reconciles to the authoritative version.
  if (decision.kind === "server_wins") {
    const { data: current, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", body.id as string)
      .single();

    if (error || !current) {
      respondSupabaseError(res, error, "Supabase fetch error:", {
        status: 500,
        error: "Failed to save report",
      });
      return;
    }

    res.status(201).json({ report: toReportResponse(current) });
    return;
  }

  const fields = {
    irrigator_type: body.irrigatorType ?? null,
    farm_name: body.farmName ?? null,
    assessor_name: body.assessorName ?? null,
    test_date: body.testDate ?? null,
    du_percent: body.duPercent ?? null,
    du_status: body.duStatus ?? null,
    report_data: body.reportData,
    client_updated_at: incomingClientUpdatedAt,
  };

  if (decision.kind === "insert") {
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        ...(body.id ? { id: body.id } : {}),
        user_id: callerId,
        ...fields,
      })
      .select()
      .single();

    if (error || !report) {
      // A concurrent request (or an offline retry of the same save) may have
      // already inserted this client id, tripping the primary-key unique
      // violation. Treat the save as idempotent: return the authoritative row
      // that won the race instead of failing with a 500.
      if (error?.code === "23505" && body.id) {
        const winner = await fetchAuthoritativeReport(body.id);
        if (winner) {
          res.status(201).json({ report: toReportResponse(winner) });
          return;
        }
      }
      respondSupabaseError(res, error, "Supabase insert error:", {
        status: 500,
        error: "Failed to save report",
      });
      return;
    }

    res.status(201).json({ report: toReportResponse(report) });
    return;
  }

  // decision.kind === "accept": overwrite the existing row. The write is
  // guarded by `client_updated_at < incoming` so that a newer save committed by
  // another request between our lookup and this update is never clobbered —
  // this keeps Last-Write-Wins correct even though lookup-then-write is not a
  // single atomic statement. Claim ownership of an anonymous row.
  const incomingMs = Date.parse(incomingClientUpdatedAt);
  const incomingIso = Number.isNaN(incomingMs)
    ? new Date().toISOString()
    : new Date(incomingMs).toISOString();

  const { data: report, error } = await supabase
    .from("reports")
    .update({ ...fields, user_id: existing?.user_id ?? callerId })
    .eq("id", body.id as string)
    .lt("client_updated_at", incomingIso)
    .select()
    .maybeSingle();

  if (error) {
    respondSupabaseError(res, error, "Supabase update error:", {
      status: 500,
      error: "Failed to save report",
    });
    return;
  }

  // No row matched the guard → a concurrent write is now newer-or-equal. Echo
  // back the current authoritative row so the client reconciles to the winner.
  const winner = report ?? (await fetchAuthoritativeReport(body.id as string));
  if (!winner) {
    console.error("Supabase update error: authoritative row missing");
    res.status(500).json({ error: "Failed to save report" });
    return;
  }

  res.status(201).json({ report: toReportResponse(winner) });
});

router.get("/reports", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", req.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    respondSupabaseError(res, error, "Supabase select error:", {
      status: 500,
      error: "Failed to fetch reports",
    });
    return;
  }

  res.json({ reports: (reports ?? []).map(toReportResponse) });
});

router.get("/reports/:id", async (req, res) => {
  const { id } = req.params;

  const { data: report, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !report) {
    if (respondIfUnavailable(res, error)) return;
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (report.user_id && req.user?.id !== report.user_id && !isAdmin(req)) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({ report: toReportResponse(report) });
});

// Soft-delete a report — sets deleted_at so it disappears from the user's
// list but remains in the database and is recoverable by an admin.
router.delete("/reports/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { id } = req.params;

  // Verify the report belongs to this user (or the caller is admin).
  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    if (respondIfUnavailable(res, fetchError)) return;
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (report.user_id !== req.user.id && !isAdmin(req)) {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    respondSupabaseError(res, updateError, "Supabase soft-delete error:", {
      status: 500,
      error: "Failed to delete report",
    });
    return;
  }

  res.json({ success: true });
});

// Admin: restore a soft-deleted report back to a user's account.
router.patch("/reports/:id/restore", async (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { id } = req.params;

  const { error } = await supabase
    .from("reports")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    respondSupabaseError(res, error, "Supabase restore error:", {
      status: 500,
      error: "Failed to restore report",
    });
    return;
  }

  res.json({ success: true });
});

// Fetch the current stored row for a client id, used to echo back the
// authoritative winner after a concurrent insert or guarded-update race.
async function fetchAuthoritativeReport(id: string) {
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function toReportResponse(r: {
  id: string;
  user_id: string | null;
  irrigator_type: string | null;
  farm_name: string | null;
  assessor_name: string | null;
  test_date: string | null;
  report_data: unknown;
  du_percent: string | null;
  du_status: string | null;
  created_at: string;
  updated_at?: string | null;
  client_updated_at?: string | null;
  deleted_at?: string | null;
}) {
  return {
    id: r.id,
    userId: r.user_id,
    irrigatorType: r.irrigator_type,
    farmName: r.farm_name,
    assessorName: r.assessor_name,
    testDate: r.test_date,
    reportData: r.report_data,
    duPercent: r.du_percent,
    duStatus: r.du_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    clientUpdatedAt: r.client_updated_at ?? null,
    deletedAt: r.deleted_at ?? null,
  };
}

export function isAdmin(req: Express.Request): boolean {
  if (!req.user) return false;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId && process.env.NODE_ENV !== "production") return true;
  return req.user.id === adminId;
}

export default router;
