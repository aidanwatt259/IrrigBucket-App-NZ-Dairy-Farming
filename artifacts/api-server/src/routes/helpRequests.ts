import { Router, type IRouter } from "express";
import { db, helpRequestsTable } from "@workspace/db";
import { SubmitHelpRequestBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/help-requests", async (req, res) => {
  const parsed = SubmitHelpRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { description, contactInfo } = parsed.data;

  const [helpRequest] = await db
    .insert(helpRequestsTable)
    .values({
      userId: req.user?.id ?? null,
      description,
      contactInfo: contactInfo ?? null,
      resolved: false,
    })
    .returning();

  res.status(201).json({
    helpRequest: {
      ...helpRequest,
      userEmail: null,
      userName: null,
      createdAt: helpRequest.createdAt.toISOString(),
    },
  });
});

export default router;
