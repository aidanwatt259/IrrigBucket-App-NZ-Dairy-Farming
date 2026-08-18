import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isAdmin } from "../lib/admin";
import {
  formatNzd,
  getAnnualAmountCents,
  getAnnualPriceNzd,
  getStripe,
  isStripeConfigured,
  isSubscriptionActive,
  paywallEnforced,
  upsertSubscriptionForUser,
} from "../lib/stripe";
import { getRequestOrigin, getSafeReturnTo } from "../lib/origin";

const router: IRouter = Router();

export async function userHasPaidAccess(req: Request): Promise<boolean> {
  if (!paywallEnforced()) return true;
  if (!req.user?.id) return false;
  if (isAdmin(req)) return true;

  const [user] = await db
    .select({
      subscriptionStatus: usersTable.subscriptionStatus,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  return isSubscriptionActive(user?.subscriptionStatus);
}

router.get("/billing/status", async (req: Request, res: Response) => {
  const configured = isStripeConfigured();
  const amountNzd = getAnnualPriceNzd();
  const authenticated = req.isAuthenticated();
  let status: string | null = null;
  let currentPeriodEnd: string | null = null;
  let hasAccess = !paywallEnforced();

  if (authenticated) {
    if (isAdmin(req)) {
      hasAccess = true;
      status = "admin";
    } else {
      const [user] = await db
        .select({
          subscriptionStatus: usersTable.subscriptionStatus,
          subscriptionCurrentPeriodEnd: usersTable.subscriptionCurrentPeriodEnd,
        })
        .from(usersTable)
        .where(eq(usersTable.id, req.user.id))
        .limit(1);

      status = user?.subscriptionStatus ?? null;
      currentPeriodEnd = user?.subscriptionCurrentPeriodEnd?.toISOString() ?? null;
      hasAccess = hasAccess || isSubscriptionActive(status);
    }
  }

  res.json({
    configured,
    authenticated,
    hasAccess,
    status,
    currentPeriodEnd,
    price: {
      amountNzd,
      currency: "nzd",
      interval: "year",
      display: `${formatNzd(amountNzd)} / year`,
    },
  });
});

router.post("/billing/checkout", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (isSubscriptionActive(user.subscriptionStatus) || isAdmin(req)) {
    res.json({ url: getSafeReturnTo(req.body?.returnTo) });
    return;
  }

  const origin = getRequestOrigin(req);
  const returnTo = getSafeReturnTo(req.body?.returnTo);
  const stripe = getStripe();
  const amountCents = getAnnualAmountCents();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db
      .update(usersTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${origin}/subscribe?checkout=success&session_id={CHECKOUT_SESSION_ID}&returnTo=${encodeURIComponent(returnTo)}`,
    cancel_url: `${origin}/subscribe?checkout=cancel&returnTo=${encodeURIComponent(returnTo)}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "nzd",
          unit_amount: amountCents,
          recurring: { interval: "year" },
          product_data: {
            name: "IrrigBucket Pro",
            description: "Annual access to test results and saved reports",
          },
        },
      },
    ],
    subscription_data: {
      metadata: { userId: user.id },
    },
    metadata: { userId: user.id },
  });

  if (!session.url) {
    res.status(500).json({ error: "Could not create checkout session" });
    return;
  }

  res.json({ url: session.url });
});

router.post("/billing/confirm", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  if (!sessionId.startsWith("cs_")) {
    res.status(400).json({ error: "Invalid checkout session" });
    return;
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== req.user.id && session.metadata?.userId !== req.user.id) {
    res.status(403).json({ error: "Checkout session does not belong to this user" });
    return;
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    res.status(402).json({ error: "Payment not complete" });
    return;
  }
  if (!session.subscription) {
    res.status(400).json({ error: "No subscription on checkout session" });
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id,
  );
  await upsertSubscriptionForUser(req.user.id, subscription);
  res.json({ ok: true, status: subscription.status });
});

router.post("/billing/portal", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const [user] = await db
    .select({ stripeCustomerId: usersTable.stripeCustomerId })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account yet" });
    return;
  }

  const origin = getRequestOrigin(req);
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/subscribe`,
  });

  res.json({ url: portal.url });
});

export default router;
