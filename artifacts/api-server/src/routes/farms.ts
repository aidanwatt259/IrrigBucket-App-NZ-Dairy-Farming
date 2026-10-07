import { Router, type IRouter, type Request, type Response } from "express";
import { SaveFarmBody, SaveIrrigatorBody } from "@workspace/api-zod";
import {
  supabase,
  respondSupabaseError,
  type Database,
  type FarmRole,
} from "../lib/supabase.js";
import { canEditFarm, decideFarmWrite } from "../lib/farmUpsert.js";
import { isAdmin } from "../lib/admin";

type FarmRow = Database["public"]["Tables"]["farms"]["Row"];
type IrrigatorRow = Database["public"]["Tables"]["irrigators"]["Row"];

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** The caller's role on a farm, or null when they are not a member. */
export async function getFarmRole(farmId: string, userId: string): Promise<FarmRole | null> {
  const { data, error } = await supabase
    .from("farm_members")
    .select("role")
    .eq("farm_id", farmId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

function toIso(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? new Date().toISOString() : new Date(ms).toISOString();
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireAuth(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return req.user.id;
}

router.get("/farms", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { data: memberships, error: memberError } = await supabase
    .from("farm_members")
    .select("farm_id, role")
    .eq("user_id", userId);
  if (memberError) {
    respondSupabaseError(res, memberError, "Supabase farm_members error:", {
      status: 500,
      error: "Failed to fetch farms",
    });
    return;
  }

  const roles = new Map((memberships ?? []).map((m) => [m.farm_id, m.role]));
  const farmIds = [...roles.keys()];
  if (farmIds.length === 0) {
    res.json({ farms: [], irrigators: [] });
    return;
  }

  const [farmsResult, irrigatorsResult] = await Promise.all([
    supabase.from("farms").select("*").in("id", farmIds).is("deleted_at", null),
    supabase.from("irrigators").select("*").in("farm_id", farmIds).is("deleted_at", null),
  ]);
  const error = farmsResult.error ?? irrigatorsResult.error;
  if (error) {
    respondSupabaseError(res, error, "Supabase farms select error:", {
      status: 500,
      error: "Failed to fetch farms",
    });
    return;
  }

  const farms = farmsResult.data ?? [];
  const liveFarmIds = new Set(farms.map((f) => f.id));
  res.json({
    farms: farms.map((f) => toFarmResponse(f, roles.get(f.id) ?? "owner")),
    irrigators: (irrigatorsResult.data ?? [])
      .filter((i) => liveFarmIds.has(i.farm_id))
      .map(toIrrigatorResponse),
  });
});

// Offline-first farm upsert keyed on the client id, with Last-Write-Wins on
// clientUpdatedAt. Creating a farm makes the caller its owner. Always responds
// with the authoritative record so the client can adopt it.
router.post("/farms", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = SaveFarmBody.safeParse(req.body);
  if (!parsed.success || !isUuid(parsed.data.id)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data;
  const name = body.name.trim();
  if (!name && !body.deletedAt) {
    res.status(400).json({ error: "Farm name is required" });
    return;
  }
  const incomingIso = toIso(body.clientUpdatedAt);

  try {
    const { data: existing, error: lookupError } = await supabase
      .from("farms")
      .select("client_updated_at")
      .eq("id", body.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const role = existing ? await getFarmRole(body.id, userId) : null;
    const decision = decideFarmWrite({
      existing,
      role,
      isAdmin: isAdmin(req),
      incomingClientUpdatedAt: incomingIso,
    });

    if (decision.kind === "forbidden") {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    const fields = {
      name: name || "Deleted farm",
      region: trimOrNull(body.region),
      contact_name: trimOrNull(body.contactName),
      contact_email: trimOrNull(body.contactEmail),
      contact_phone: trimOrNull(body.contactPhone),
      notes: trimOrNull(body.notes),
      client_updated_at: incomingIso,
      deleted_at: body.deletedAt ? toIso(body.deletedAt) : null,
    };

    if (decision.kind === "insert") {
      const { error: insertError } = await supabase
        .from("farms")
        .insert({ id: body.id, created_by: userId, ...fields });
      if (insertError) {
        // A retried create raced another request for the same id: answer with
        // whatever won, if this caller may see it.
        if (insertError.code === "23505") {
          const winnerRole = await getFarmRole(body.id, userId);
          const winner = await fetchFarm(body.id);
          if (winner && winnerRole) {
            res.status(201).json({ farm: toFarmResponse(winner, winnerRole) });
            return;
          }
          res.status(403).json({ error: "Not authorised" });
          return;
        }
        throw insertError;
      }
      const { error: memberError } = await supabase
        .from("farm_members")
        .insert({ farm_id: body.id, user_id: userId, role: "owner" });
      if (memberError) {
        await supabase.from("farms").delete().eq("id", body.id);
        throw memberError;
      }
      const created = await fetchFarm(body.id);
      if (!created) throw new Error("Created farm missing");
      res.status(201).json({ farm: toFarmResponse(created, "owner") });
      return;
    }

    if (decision.kind === "accept") {
      // Guarded so a newer write that landed after our lookup is never clobbered.
      const { error: updateError } = await supabase
        .from("farms")
        .update(fields)
        .eq("id", body.id)
        .lt("client_updated_at", incomingIso);
      if (updateError) throw updateError;
    }

    const current = await fetchFarm(body.id);
    if (!current) throw new Error("Farm missing after write");
    res.status(201).json({ farm: toFarmResponse(current, role ?? "owner") });
  } catch (err) {
    respondSupabaseError(res, err, "Supabase farm upsert error:", {
      status: 500,
      error: "Failed to save farm",
    });
  }
});

router.post("/irrigators", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = SaveIrrigatorBody.safeParse(req.body);
  if (!parsed.success || !isUuid(parsed.data.id) || !isUuid(parsed.data.farmId)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data;
  const name = body.name.trim();
  const type = body.type.trim();
  if ((!name || !type) && !body.deletedAt) {
    res.status(400).json({ error: "Irrigator name and type are required" });
    return;
  }
  const incomingIso = toIso(body.clientUpdatedAt);
  const admin = isAdmin(req);

  try {
    const farm = await fetchFarm(body.farmId);
    if (!farm) {
      res.status(409).json({ error: "Farm has not been saved yet" });
      return;
    }

    const { data: existing, error: lookupError } = await supabase
      .from("irrigators")
      .select("farm_id, client_updated_at")
      .eq("id", body.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.farm_id !== body.farmId) {
      res.status(400).json({ error: "Irrigators cannot move between farms" });
      return;
    }

    const role = await getFarmRole(body.farmId, userId);
    if (!admin && !canEditFarm(role)) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }
    const decision = decideFarmWrite({
      existing,
      role,
      isAdmin: admin,
      incomingClientUpdatedAt: incomingIso,
    });

    const fields = {
      name: name || "Deleted irrigator",
      type: type || "unknown",
      details: body.details ?? {},
      test_interval_months: Math.round(body.testIntervalMonths ?? 12),
      client_updated_at: incomingIso,
      deleted_at: body.deletedAt ? toIso(body.deletedAt) : null,
    };

    if (decision.kind === "insert") {
      const { error: insertError } = await supabase
        .from("irrigators")
        .insert({ id: body.id, farm_id: body.farmId, created_by: userId, ...fields });
      if (insertError && insertError.code !== "23505") throw insertError;
    } else if (decision.kind === "accept") {
      const { error: updateError } = await supabase
        .from("irrigators")
        .update(fields)
        .eq("id", body.id)
        .lt("client_updated_at", incomingIso);
      if (updateError) throw updateError;
    }

    const { data: current, error: fetchError } = await supabase
      .from("irrigators")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!current) throw new Error("Irrigator missing after write");
    res.status(201).json({ irrigator: toIrrigatorResponse(current) });
  } catch (err) {
    respondSupabaseError(res, err, "Supabase irrigator upsert error:", {
      status: 500,
      error: "Failed to save irrigator",
    });
  }
});

async function fetchFarm(id: string): Promise<FarmRow | null> {
  const { data, error } = await supabase.from("farms").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function toFarmResponse(f: FarmRow, role: FarmRole) {
  return {
    id: f.id,
    name: f.name,
    region: f.region,
    contactName: f.contact_name,
    contactEmail: f.contact_email,
    contactPhone: f.contact_phone,
    notes: f.notes,
    role,
    createdAt: f.created_at,
    updatedAt: f.updated_at ?? null,
    clientUpdatedAt: f.client_updated_at,
    deletedAt: f.deleted_at ?? null,
  };
}

function toIrrigatorResponse(i: IrrigatorRow) {
  return {
    id: i.id,
    farmId: i.farm_id,
    name: i.name,
    type: i.type,
    details: i.details ?? {},
    testIntervalMonths: i.test_interval_months,
    createdAt: i.created_at,
    updatedAt: i.updated_at ?? null,
    clientUpdatedAt: i.client_updated_at,
    deletedAt: i.deleted_at ?? null,
  };
}

export default router;
