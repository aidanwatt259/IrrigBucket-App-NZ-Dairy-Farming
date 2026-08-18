import type { Request, Response } from "express";
import type Stripe from "stripe";
import { logger } from "../lib/logger";
import {
  findUserIdForSubscription,
  getStripe,
  upsertSubscriptionForUser,
} from "../lib/stripe";

async function applySubscription(subscription: Stripe.Subscription) {
  const userId = await findUserIdForSubscription(subscription);
  if (!userId) {
    logger.warn(
      { subscriptionId: subscription.id },
      "Stripe subscription had no matching user",
    );
    return;
  }
  await upsertSubscriptionForUser(userId, subscription);
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (!secret || typeof signature !== "string") {
    res.status(400).json({ error: "Missing webhook secret or signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subscription = await getStripe().subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
        const userId =
          session.client_reference_id ||
          session.metadata?.userId ||
          subscription.metadata?.userId;
        if (userId) {
          await upsertSubscriptionForUser(userId, subscription);
        } else {
          await applySubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Stripe webhook handler failed");
    res.status(500).json({ error: "Webhook handler failed" });
    return;
  }

  res.json({ received: true });
}
