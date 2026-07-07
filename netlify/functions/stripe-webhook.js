import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

// Stripe webhook: records plan state in Netlify Blobs.
// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars.
// Subscribe this endpoint to: checkout.session.completed,
// customer.subscription.updated, customer.subscription.deleted

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  const store = getStore("storefront-check");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const scSession = session.client_reference_id;
      if (scSession) {
        await store.setJSON(`plan:${scSession}`, {
          status: "active",
          customerId: session.customer,
          subscriptionId: session.subscription,
          updatedAt: new Date().toISOString(),
        });
        // Reverse index so subscription events (which only carry the Stripe
        // customer id) can find our session.
        await store.set(`customer:${session.customer}`, scSession);
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const scSession = await store.get(`customer:${subscription.customer}`);
      if (scSession) {
        const active =
          event.type !== "customer.subscription.deleted" &&
          ["active", "trialing"].includes(subscription.status);
        await store.setJSON(`plan:${scSession}`, {
          status: active ? "active" : "inactive",
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          updatedAt: new Date().toISOString(),
        });
      }
      break;
    }
  }

  return Response.json({ received: true });
};
