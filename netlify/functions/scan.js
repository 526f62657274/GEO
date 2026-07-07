import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";

// Server-side scan engine. The Anthropic API key lives ONLY here, read from
// the ANTHROPIC_API_KEY environment variable set in Netlify's dashboard.

const FREE_SCAN_LIMIT = 1;

function buildPrompt({ query }) {
  return `You are an AI-visibility auditor for local businesses. The user typed only this to identify their business:

"${query}"

STEP 1 — Identify the business. Search the web (especially Google Business Profile / Google Maps results) to find this business. From what you find, work out its proper name, its category (what it does), and its city/location. If several businesses match and the user gave no location, pick the most prominent match.

STEP 2 — Audit its AI visibility. Grade how likely an AI assistant (like ChatGPT or Claude) would be to find and recommend it when someone asks for "the best <category> in <city>". Search for evidence of:
- Its Google Business Profile / Google Maps listing (claimed? complete? photos? hours?)
- Review volume and average rating (Google, Yelp, or similar)
- A working website that names the business, category, and city
- Mentions in local directories or "best <category> in <city>" style articles
- Any social media presence

Then respond with ONLY a JSON object (no markdown fences, no commentary) in exactly this shape:
{
  "business": { "name": "resolved business name", "category": "what it does, e.g. bakery", "city": "city and region, e.g. Portland, OR" },
  "grade": "A" | "B" | "C" | "D" | "F",
  "score": 0-100,
  "headline": "one-sentence plain-English verdict",
  "checks": [
    { "name": "what was checked", "status": "pass" | "warn" | "fail", "detail": "one plain-English sentence about what you found" }
  ],
  "fixes": [
    { "title": "short imperative fix", "detail": "one or two sentences on what to do and why it matters" }
  ]
}

Include 5 to 7 checks and 3 to 5 fixes, ordered by impact. Base everything on what you actually found in your searches. If you cannot find the business at all, use the user's text as the name, leave category/city as empty strings, say so plainly in the headline, and grade accordingly.`;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, sessionId } = body || {};
  if (!query || !sessionId) {
    return Response.json(
      { error: "query and sessionId are required" },
      { status: 400 }
    );
  }

  const store = getStore("storefront-check");

  // Free-tier limiting, enforced server-side. Paid plan state is written by
  // the Stripe webhook (see stripe-webhook.js).
  const plan = await store.get(`plan:${sessionId}`, { type: "json" });
  const isPro = plan?.status === "active";
  const used = Number(await store.get(`scans:${sessionId}`)) || 0;
  if (!isPro && used >= FREE_SCAN_LIMIT) {
    return Response.json(
      { error: "Free scan limit reached", scansUsed: used },
      { status: 402 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt({ query });
  const requestParams = {
    model: "claude-sonnet-4-6",
    // Slightly more headroom than v1: the report now also carries the
    // resolved business details (name/category/city).
    max_tokens: 1500,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
  };

  try {
    let response = await client.messages.create({
      ...requestParams,
      messages: [{ role: "user", content: prompt }],
    });

    // Server-side web search can pause after its iteration limit; re-send the
    // conversation to let it resume (see Anthropic docs on pause_turn).
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < 5) {
      response = await client.messages.create({
        ...requestParams,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: response.content },
        ],
      });
      continuations++;
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    const report = extractJson(text);

    await store.set(`scans:${sessionId}`, String(used + 1));

    return Response.json({ report, scansUsed: used + 1, isPro });
  } catch (err) {
    console.error("scan failed:", err);
    return Response.json(
      { error: "The scan failed — please try again in a minute." },
      { status: 502 }
    );
  }
};
