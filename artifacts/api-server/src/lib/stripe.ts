import Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function paywallEnforced(): boolean {
  if (!isStripeConfigured()) {
    return process.env.NODE_ENV === "production";
  }
  return true;
}

export function getAnnualPriceNzd(): number {
  const nzd = Number(process.env.STRIPE_ANNUAL_PRICE_NZD ?? "149");
  if (!Number.isFinite(nzd) || nzd <= 0) {
    throw new Error("STRIPE_ANNUAL_PRICE_NZD must be a positive number");
  }
  return nzd;
}

export function getAnnualAmountCents(): number {
  return Math.round(getAnnualPriceNzd() * 100);
}

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function formatNzd(amountNzd: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: amountNzd % 1 === 0 ? 0 : 2,
  }).format(amountNzd);
}

export function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const unix =
    subscription.items?.data?.[0]?.current_period_end ??
    (subscription as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;
  return typeof unix === "number" ? new Date(unix * 1000) : null;
}

export async function upsertSubscriptionForUser(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  await db
    .update(usersTable)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: subscriptionPeriodEnd(subscription),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

export async function findUserIdForSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metadataUserId = subscription.metadata?.userId;
  if (metadataUserId) return metadataUserId;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      or(
        eq(usersTable.stripeSubscriptionId, subscription.id),
        eq(usersTable.stripeCustomerId, customerId),
      ),
    )
    .limit(1);

  return user?.id ?? null;
}
