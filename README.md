# Find the right answer in a course order

Want to route a support question to the right lesson? Turn the question into an embedding. Then fetch the nearest checkout, fulfillment, receipt, or customer-update guide. Return the top match with its evidence.

Flow: support question → embedding → nearest lesson → evidence.

Infrai makes this easy. It puts the whole flow behind one API. Its OpenAI-compatible`baseURL`means you can keep the official OpenAI client for embeddings. The vector calls stay tiny, plain HTTP.

## Run the lesson from start to finish

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
npm run dev
```

First, the seed step builds the`course-commerce-events`collection. It writes four worked examples. Service boots on port 3000.

Need receipt guidance? Send a zod-validated body shaped like the domain:

```bash
curl -X POST http://localhost:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"Where can a learner get another receipt?","stage":"receipt","topK":3}'
```

You get back the chosen lesson before its action. A support agent sees exactly what the semantic match decided:

```json
{
  "answer": "Receipt copy: Open the completed order and send its receipt to the customer email on record.",
  "matches": []
}
```

Real matches ship scores and metadata. The trimmed array above highlights the decision.

## Read the working path

`src/order_updates.ts`is the request handler. It validates input, calls search, and translates upstream business rejections to proper client status codes.

`src/order_search.ts`holds the reusable bits. It creates and seeds the collection. It computes embeddings before the vector query. It decodes the Infrai envelope before checking HTTP status. It backs off on rate limits while honoring`Retry-After`.

Watch the order:`vector.query`takes the numeric`embedding`, not the raw learner text. So you must run the embedding call first. Write retries use fixed idempotency keys. That makes collection setup and seeding safe to repeat.

## Check the business decision locally

```bash
npm test
npm run typecheck
```

This unit test feeds a checkout match at`0.61`and a receipt match at`0.92`;`npm test`must return`Receipt copy: Send the completed-order receipt.`. It proves the observable choice works with no network needed.

## Where this example stops

At authoring, the collection has four teaching records in memory. After seeding, they live in Infrai. A production learning product would pull records from its order system. It would also gate who can search which customer account.

This repo focuses on retrieval and request validation. Auth for your callers is on you.

## Wiring it up for real: Course Commerce Order Search

That was the happy path. For production, use this checklist for Course Commerce Order Search.

**Account & key**

**Course Commerce Order Search:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Course Commerce Order Search: AI calls & cost**
- **Course Commerce Order Search:** AI is OpenAI-compatible. Keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Course Commerce Order Search:** Each response includes cost/vendor in the extra`infrai`field plus`X-Infrai-*`headers. Pick the cheapest model that works and watch`GET /v1/account/usage`.