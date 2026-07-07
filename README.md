# Storefront Check

An AI-visibility scanner for local businesses. Enter a business name, category,
and city — the app researches the business's real online footprint (via the
Anthropic API with web search) and returns a graded inspection certificate with
plain-English fixes. Free users get one scan; a $19/month plan unlocks weekly
tracking (Stripe).

## How it's put together

| Piece | Where | Notes |
|---|---|---|
| Frontend | `src/App.jsx` (Vite + React) | The "inspection certificate" UI. Calls `/.netlify/functions/scan` — never the Anthropic API directly. |
| Scan engine | `netlify/functions/scan.js` | Reads `ANTHROPIC_API_KEY` from env, calls Claude (`claude-sonnet-4-6`) with the web search tool, returns parsed JSON. Also enforces the free-scan limit. |
| Usage / plan state | Netlify Blobs (store `storefront-check`) | `scans:{sessionId}` = scan count, `plan:{sessionId}` = subscription state, `customer:{stripeCustomerId}` = reverse lookup. No database needed yet. |
| Payments | `netlify/functions/create-checkout-session.js` + `stripe-webhook.js` | Stripe Checkout subscription; webhook records plan state. |

The frontend identifies visitors with an anonymous session id in
`localStorage` (`sc_session`). The limit is enforced **server-side** — clearing
browser storage gets a new session id, which is a known limitation until real
accounts (Supabase) arrive in a later version.

## Secrets — read this first

**Never commit API keys.** All secrets live in environment variables:

- `ANTHROPIC_API_KEY` — required for scans
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — required for payments

`.env` is gitignored. Use `.env.example` as the template for local dev.

## Run locally

```bash
npm install
npm run dev          # UI only — scans will fail without the functions
```

To run the functions locally too (recommended), use the Netlify CLI:

```bash
npm install -g netlify-cli
cp .env.example .env       # fill in your real keys
netlify dev                # serves UI + functions at http://localhost:8888
```

## Deploy to Netlify

1. **Push to GitHub** (already done if you're reading this on GitHub).
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick
   this repo. Netlify reads `netlify.toml`, so build command (`npm run build`),
   publish dir (`dist`), and functions dir are already configured — just click
   **Deploy**.
3. In your new site: **Site configuration → Environment variables → Add a
   variable**, and add `ANTHROPIC_API_KEY` (from
   https://console.anthropic.com → API Keys).
4. **Deploys → Trigger deploy** so the function picks up the new variable.
5. Open your `*.netlify.app` URL and run a scan end to end.

## Stripe setup (for the upgrade button)

In the [Stripe dashboard](https://dashboard.stripe.com) — start in **Test
mode** (toggle top-right):

1. **Create the product**: Product catalog → Add product.
   Name: `Storefront Check — Weekly Tracking`. Price: **$19.00 USD, Recurring,
   Monthly**. Save, then copy the **Price ID** (`price_...`).
2. **Get your secret key**: Developers → API keys → copy the **Secret key**
   (`sk_test_...`).
3. **Create the webhook**: Developers → Webhooks → Add endpoint.
   - Endpoint URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Save, then copy the **Signing secret** (`whsec_...`).
4. **Add env vars in Netlify** (Site configuration → Environment variables):
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
5. **Trigger a redeploy**, then test: use up your free scan, click
   **Upgrade & keep watch**, and pay with Stripe's test card
   `4242 4242 4242 4242` (any future expiry, any CVC). After checkout you
   should be able to scan again immediately.

When you're ready for real money, repeat steps 1–4 in **Live mode** with live
keys.

## What's next (planned iterations)

- Weekly re-scan job + email alerts for subscribers
- Competitor comparison column
- Real accounts (Supabase Postgres) replacing the anonymous session id
- Multi-location support
