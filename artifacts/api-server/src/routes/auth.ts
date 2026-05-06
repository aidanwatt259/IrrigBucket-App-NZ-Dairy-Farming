import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
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
  res.json({ success: true });
});

// Clear the server session. The frontend handles Supabase signOut separately.
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
