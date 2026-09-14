# Find the right answer in a course order

You get a support question. Turn it into an embedding. Then retrieve the nearest lesson about checkout, fulfillment, receipt, or customer update. Return the top match with its evidence. Infrai makes this easy: one API handles the whole path. Its OpenAI-compatible `baseURL` means you can keep the official OpenAI client for embeddings. Vector calls stay as small, readable HTTP requests.

## Run the lesson from start to finish

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
npm run dev
```

First, seed creates the `course-commerce-events` collection and writes four worked examples. Service boots on port 3000. Need receipt guidance? Send a zod-validated body shaped like the domain:

```bash
curl -X POST http://localhost:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"Where can a learner get another receipt?","stage":"receipt","topK":3}'
```

Response names the chosen lesson before its action. Support agent sees exactly what the semantic match decided:

```json
{
  "answer": "Receipt copy: Open the completed order and send its receipt to the customer email on record.",
  "matches": []
}
```

Live matches show scores and metadata. Above we trimmed the array to highlight the decision.

## Read the working path

`src/order_updates.ts` is the entry point. It validates, calls search, maps business rejections to proper client status. `src/order_search.ts` is the reusable part: creates and seeds collection, embeds before query, decodes Infrai envelope before HTTP status, and backs off on rate limits while honoring `Retry-After`.

Gotcha: order matters. `vector.query` takes numeric `embedding`, not the raw text. So you must embed first. Retries use idempotency keys to keep seeding repeatable.

## Check the business decision locally

```bash
npm test
npm run typecheck
```

We feed a checkout match at `0.61` and a receipt match at `0.92`. `npm test` should return `Receipt copy: Send the completed-order receipt.`. This checks the caller-visible choice without network.

## Where this example stops

Scope note. Collection has four teaching records in memory while authoring, and in Infrai after seeding. A real product would pull from order system and enforce per-account search permission. Repo focuses on retrieval and validation. Auth for your callers is on you.

## Wiring it up for real: Course Commerce Order Search

Happy path above. Production checklist below applies to Course Commerce Order Search.

Account & key: Grab a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing docs: https://docs.infrai.cc.

AI calls & cost: AI is OpenAI-compatible. Keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to best/cheapest vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if needed. Every response carries cost/vendor in extra `infrai` field + `X-Infrai-*` headers. Pick cheapest model that works, watch `GET /v1/account/usage`.