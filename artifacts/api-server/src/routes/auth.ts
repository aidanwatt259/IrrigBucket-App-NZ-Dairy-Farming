import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { supabase } from "../lib/supabase";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { isAdmin } from "./reports.js";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

async function upsertUser(userData: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}) {
  const [user] = await db
    .insert(usersTable)
    .values({
      id: userData.id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

// Return public Supabase config so the browser can initialise its own client.
// The anon key is intentionally public — it is scoped by Row Level Security.
router.get("/config", (_req: Request, res: Response) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  });
});

// Get the currently authenticated user from the server session.
router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated()
        ? { ...req.user, isAdmin: isAdmin(req) }
        : null,
    }),
  );
});

// Exchange a valid Supabase access token for a server-side session cookie.
// Called by the frontend immediately after a successful Supabase sign-in.
router.post("/auth/supabase-session", async (req: Request, res: Response) => {
  const { access_token, refresh_token } = req.body ?? {};

  if (!access_token) {
    res.status(400).json({ error: "access_token is required" });
    return;
  }

  // Validate the token against Supabase Auth — this is a live API call.
  const { data: { user }, error } = await supabase.auth.getUser(access_token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const meta = user.user_metadata ?? {};

  // Split full_name into first/last if individual fields are absent.
  const fullNameParts = (meta.full_name as string | undefined)?.split(" ") ?? [];
  const firstName = (meta.first_name as string | undefined) ?? fullNameParts[0] ?? null;
  const lastName =
    (meta.last_name as string | undefined) ??
    (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : null);

  const dbUser = await upsertUser({
    id: user.id,
    email: user.email,
    firstName,
    lastName,
    profileImageUrl: (meta.avatar_url as string | undefined) ?? null,
  });

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token,
    refresh_token: refresh_token ?? undefined,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  // Bearer (mobile) clients have no cookie jar and need the session id in the
  // body. They opt in with `returnSid: true`. Cookie clients (web) keep using
  // the httpOnly cookie ONLY — the sid is never placed in their response body,
  // preserving the XSS-token-theft protection httpOnly provides.
  const returnSid = req.body?.returnSid === true;
  res.setHeader("Cache-Control", "no-store");
  res.json(returnSid ? { success: true, sid } : { success: true });
});

// Clear the server session. The frontend handles Supabase signOut separately.
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

// Permanently delete the authenticated user's account and ALL associated data.
// Required by the Apple App Store (Guideline 5.1.1(v)) and Google Play for apps
// that let users create an account. Unlike DELETE /reports/:id (a recoverable
// soft-delete), this is an irreversible hard delete.
router.delete("/auth/account", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const userId = req.user.id;

  // 1. Hard-delete every user-owned row so no PII lingers in the database.
  for (const table of ["reports", "help_requests", "feedback"] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`Failed to delete ${table} during account deletion:`, error);
      res.status(500).json({ error: "Failed to delete account data" });
      return;
    }
  }

  // 2. Remove the local user mirror and EVERY session for this user (all
  //    devices), so no stale sid can authenticate as the deleted account.
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await db
    .delete(sessionsTable)
    .where(sql`${sessionsTable.sess} -> 'user' ->> 'id' = ${userId}`);

  // 3. Delete the Supabase Auth identity itself (login + email). Best-effort:
  //    the account's data is already gone, so a failure here must not strand the
  //    user with an account they cannot delete — log it and still succeed.
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("Failed to delete Supabase Auth user:", authError);
  }

  // 4. Clear the web session cookie (no-op for bearer/mobile clients).
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ success: true });
});

export default router;
