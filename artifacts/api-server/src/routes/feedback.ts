import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

router.post("/feedback", async (req, res) => {
  const { message, contactInfo } = req.body ?? {};

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const { data: row, error } = await supabase
    .from("feedback")
    .insert({
      user_id: req.user?.id ?? null,
      message: message.trim(),
      contact_info: typeof contactInfo === "string" && contactInfo.trim() ? contactInfo.trim() : null,
    })
    .select()
    .single();

  if (error || !row) {
    console.error("Supabase insert error:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
    return;
  }

  res.status(201).json({
    feedback: {
      id: row.id,
      createdAt: row.created_at,
    },
  });
});

export default router;
