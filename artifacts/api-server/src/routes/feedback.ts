import { Router, type IRouter } from "express";
import { db, feedbackTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/feedback", async (req, res) => {
  const { message, contactInfo } = req.body ?? {};

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const [row] = await db
    .insert(feedbackTable)
    .values({
      userId: req.user?.id ?? null,
      message: message.trim(),
      contactInfo: typeof contactInfo === "string" && contactInfo.trim() ? contactInfo.trim() : null,
    })
    .returning();

  res.status(201).json({
    feedback: {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    },
  });
});

export default router;
