import Stripe from "stripe";

// Creates a Stripe Checkout session for the $19/month plan.
// Requires STRIPE_SECRET_KEY and STRIPE_PRICE_ID env vars in Netlify.

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return Response.json(
      { error: "Payments are not configured yet" },
      { status: 501 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.get("origin") || process.env.URL;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // Ties the Stripe customer back to our anonymous scan session so the
      // webhook can mark the right session as paid.
      client_reference_id: sessionId,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("checkout session failed:", err);
    return Response.json(
      { error: "Could not start checkout" },
      { status: 502 }
    );
  }
};
