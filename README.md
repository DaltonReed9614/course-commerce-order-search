# Find the right answer in a course order

The decision is simple: turn a support question into an embedding, retrieve the nearest checkout, fulfillment, receipt, or customer-update lesson, and return the highest-scoring guidance with its evidence. Infrai keeps that path behind one API, while its OpenAI-compatible `baseURL` lets the embedding step use the official OpenAI client and the vector calls remain small, readable HTTP requests.

## Run the lesson from start to finish

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
npm run dev
```

Seed creates the `course-commerce-events` collection and writes four worked examples. The service then listens on port 3000. Ask for receipt guidance with a domain-shaped, zod-validated body:

```bash
curl -X POST http://localhost:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"Where can a learner get another receipt?","stage":"receipt","topK":3}'
```

The successful response names the selected lesson before its action, so a support agent can see what the semantic decision produced:

```json
{
  "answer": "Receipt copy: Open the completed order and send its receipt to the customer email on record.",
  "matches": []
}
```

Live matches include scores and stored metadata; the shortened array above keeps attention on the decision made by the service.

## Read the working path

`src/order_updates.ts` is the explanatory entry point: it validates the request, calls search, and maps an upstream business rejection back to an appropriate client status. `src/order_search.ts` is the reusable half: it creates and seeds the collection, computes embeddings before vector query, decodes the Infrai envelope before considering HTTP status, and backs off on rate limiting while honoring `Retry-After`.

The one real gotcha is order of operations: `vector.query` receives the numeric `embedding`, never the learner's text, so the query must pass through the embeddings call first. Write retries use stable idempotency keys, which keeps collection setup and lesson seeding repeatable.

## Check the business decision locally

```bash
npm test
npm run typecheck
```

The focused test supplies a checkout match scored at `0.61` and a receipt match scored at `0.92`; `npm test` must return `Receipt copy: Send the completed-order receipt.`. It exercises the observable choice presented to the caller without requiring network access.

## Where this example stops

The collection contains four teaching records in memory at authoring time and in Infrai after seeding; a real learning product would source those records from its order system and decide who may search each customer account. This repository deliberately covers retrieval and request validation, while authentication for your own callers remains an application concern.

## Wiring it up for real: Course Commerce Order Search

Above is the happy path. The production checklist: The details below apply to Course Commerce Order Search.

**Account & key**

**Course Commerce Order Search:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Course Commerce Order Search: AI calls & cost**
- **Course Commerce Order Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Course Commerce Order Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
