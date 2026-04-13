import { Router, type IRouter } from "express";
import { SaveReportBody } from "@workspace/api-zod";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

router.post("/reports", async (req, res) => {
  const parsed = SaveReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { irrigatorType, farmName, assessorName, testDate, duPercent, duStatus, reportData } = parsed.data;

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      user_id: req.user?.id ?? null,
      irrigator_type: irrigatorType ?? null,
      farm_name: farmName ?? null,
      assessor_name: assessorName ?? null,
      test_date: testDate ?? null,
      du_percent: duPercent ?? null,
      du_status: duStatus ?? null,
      report_data: reportData,
    })
    .select()
    .single();

  if (error || !report) {
    console.error("Supabase insert error:", error);
    res.status(500).json({ error: "Failed to save report" });
    return;
  }

  res.status(201).json({ report: toReportResponse(report) });
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase select error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
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
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (report.user_id && req.user?.id !== report.user_id && !isAdmin(req)) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({ report: toReportResponse(report) });
});

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
  };
}

export function isAdmin(req: Express.Request): boolean {
  if (!req.user) return false;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId && process.env.NODE_ENV !== "production") return true;
  return req.user.id === adminId;
}

export default router;
