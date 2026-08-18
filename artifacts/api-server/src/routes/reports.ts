import { Router, type IRouter, type Request, type Response } from "express";
import { db, reportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { SaveReportBody } from "@workspace/api-zod";
import { isAdmin } from "../lib/admin";
import { userHasPaidAccess } from "./billing";

const router: IRouter = Router();

async function requirePaidAccess(req: Request, res: Response): Promise<boolean> {
  if (await userHasPaidAccess(req)) return true;
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  res.status(402).json({ error: "Subscription required" });
  return false;
}

router.post("/reports", async (req, res) => {
  if (!(await requirePaidAccess(req, res))) return;

  const parsed = SaveReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { irrigatorType, farmName, assessorName, testDate, duPercent, duStatus, reportData } = parsed.data;

  const [report] = await db
    .insert(reportsTable)
    .values({
      userId: req.user?.id ?? null,
      irrigatorType: irrigatorType ?? null,
      farmName: farmName ?? null,
      assessorName: assessorName ?? null,
      testDate: testDate ?? null,
      duPercent: duPercent ?? null,
      duStatus: duStatus ?? null,
      reportData,
    })
    .returning();

  res.status(201).json({ report: { ...report, createdAt: report.createdAt.toISOString() } });
});

router.get("/reports", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!(await requirePaidAccess(req, res))) return;

  const reports = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.userId, req.user.id))
    .orderBy(desc(reportsTable.createdAt));

  res.json({
    reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});

router.get("/reports/:id", async (req, res) => {
  const { id } = req.params;

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, id))
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (report.userId && req.user?.id !== report.userId && !isAdmin(req)) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (!(await userHasPaidAccess(req))) {
    res.status(402).json({ error: "Subscription required" });
    return;
  }

  res.json({ report: { ...report, createdAt: report.createdAt.toISOString() } });
});

export default router;
