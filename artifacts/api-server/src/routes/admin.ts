import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, reportsTable, helpRequestsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "../lib/admin";

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

router.get("/admin/reports", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: reportsTable.id,
      userId: reportsTable.userId,
      irrigatorType: reportsTable.irrigatorType,
      farmName: reportsTable.farmName,
      assessorName: reportsTable.assessorName,
      testDate: reportsTable.testDate,
      duPercent: reportsTable.duPercent,
      duStatus: reportsTable.duStatus,
      reportData: reportsTable.reportData,
      createdAt: reportsTable.createdAt,
      userEmail: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(reportsTable)
    .leftJoin(usersTable, eq(reportsTable.userId, usersTable.id))
    .orderBy(desc(reportsTable.createdAt));

  res.json({
    reports: rows.map((r) => ({
      ...r,
      userName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      firstName: undefined,
      lastName: undefined,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.get("/admin/help-requests", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: helpRequestsTable.id,
      userId: helpRequestsTable.userId,
      description: helpRequestsTable.description,
      contactInfo: helpRequestsTable.contactInfo,
      resolved: helpRequestsTable.resolved,
      createdAt: helpRequestsTable.createdAt,
      userEmail: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(helpRequestsTable)
    .leftJoin(usersTable, eq(helpRequestsTable.userId, usersTable.id))
    .orderBy(desc(helpRequestsTable.createdAt));

  res.json({
    helpRequests: rows.map((r) => ({
      ...r,
      userName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      firstName: undefined,
      lastName: undefined,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.patch("/admin/help-requests/:id/resolve", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const [updated] = await db
    .update(helpRequestsTable)
    .set({ resolved: true })
    .where(eq(helpRequestsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Help request not found" });
    return;
  }

  res.json({
    helpRequest: {
      ...updated,
      userEmail: null,
      userName: null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
});

export default router;
