import { Router, type IRouter, type Request, type Response } from "express";
import type { BusinessProfile } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  normalizeProfile,
  profileFromColumns,
  profileToColumns,
} from "../lib/businessProfile";

const router: IRouter = Router();

/** The business profile a user prints on their reports (empty when unset). */
export async function loadBusinessProfile(userId: string): Promise<BusinessProfile> {
  const [row] = await db
    .select({
      businessName: usersTable.businessName,
      businessContactName: usersTable.businessContactName,
      businessPhone: usersTable.businessPhone,
      businessEmail: usersTable.businessEmail,
      businessWebsite: usersTable.businessWebsite,
      businessLogo: usersTable.businessLogo,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return profileFromColumns(row);
}

router.get("/account/business-profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const profile = await loadBusinessProfile(req.user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ profile });
  } catch (error) {
    console.error("Error loading business profile:", error);
    res.status(500).json({ error: "Failed to load business profile" });
  }
});

router.put("/account/business-profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const result = normalizeProfile(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    await db
      .update(usersTable)
      .set(profileToColumns(result.profile))
      .where(eq(usersTable.id, req.user.id));
    res.setHeader("Cache-Control", "no-store");
    res.json({ profile: result.profile });
  } catch (error) {
    console.error("Error saving business profile:", error);
    res.status(500).json({ error: "Failed to save business profile" });
  }
});

export default router;
