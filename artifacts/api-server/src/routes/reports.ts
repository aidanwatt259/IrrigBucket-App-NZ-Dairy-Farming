import { Router, type IRouter } from "express";
import { db, reportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { SaveReportBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/reports", async (req, res) => {
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

  res.json({ report: { ...report, createdAt: report.createdAt.toISOString() } });
});

export function isAdmin(req: Express.Request): boolean {
  if (!req.user) return false;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId && process.env.NODE_ENV !== "production") return true;
  return req.user.id === adminId;
}

export default router;
