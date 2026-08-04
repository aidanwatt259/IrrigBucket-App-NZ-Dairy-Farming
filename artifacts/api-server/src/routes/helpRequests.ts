import { Router, type IRouter } from "express";
import { SubmitHelpRequestBody } from "@workspace/api-zod";
import { supabase, respondSupabaseError } from "../lib/supabase.js";

const router: IRouter = Router();

router.post("/help-requests", async (req, res) => {
  const parsed = SubmitHelpRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { description, contactInfo } = parsed.data;

  const { data: helpRequest, error } = await supabase
    .from("help_requests")
    .insert({
      user_id: req.user?.id ?? null,
      description,
      contact_info: contactInfo ?? null,
      resolved: false,
    })
    .select()
    .single();

  if (error || !helpRequest) {
    respondSupabaseError(res, error, "Supabase insert error:", {
      status: 500,
      error: "Failed to submit help request",
    });
    return;
  }

  res.status(201).json({
    helpRequest: {
      id: helpRequest.id,
      userId: helpRequest.user_id,
      description: helpRequest.description,
      contactInfo: helpRequest.contact_info,
      resolved: helpRequest.resolved,
      userEmail: null,
      userName: null,
      createdAt: helpRequest.created_at,
    },
  });
});

export default router;
