import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import {
  InfraiError,
  explainBestMatch,
  searchCommerceLessons,
  seedCommerceLessons,
  type CommerceLesson,
} from "./order_search.js";

const searchBody = z.object({
  query: z.string().trim().min(3).max(300),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_update"]).optional(),
  topK: z.number().int().min(1).max(10).default(4),
});

const lessons: CommerceLesson[] = [
  { id: "checkout-payment", stage: "checkout", title: "Checkout payment pending", guidance: "Ask the learner to confirm the payment method before placing the course order again." },
  { id: "fulfillment-access", stage: "fulfillment", title: "Course access delivery", guidance: "Confirm enrollment fulfillment, then resend the course access notice." },
  { id: "receipt-download", stage: "receipt", title: "Receipt copy", guidance: "Open the completed order and send its receipt to the customer email on record." },
  { id: "update-order-status", stage: "customer_update", title: "Order progress update", guidance: "Share the current order stage and the next expected learning-access event." },
];

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function clientStatus(error: unknown): number {
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) return error.status;
  return 500;
}

async function main(): Promise<void> {
  if (process.argv.includes("--seed")) {
    await seedCommerceLessons(lessons);
    console.log(`Seeded ${lessons.length} course-commerce lessons.`);
    return;
  }

  const port = Number(process.env.PORT ?? 3000);
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/search") {
      send(response, 404, { error: "Route not found" });
      return;
    }
    try {
      const input = searchBody.parse(await readJson(request));
      const matches = await searchCommerceLessons(input.query, input.stage, input.topK);
      send(response, 200, { answer: explainBestMatch(matches), matches });
    } catch (error) {
      if (error instanceof z.ZodError) {
        send(response, 400, { error: "Invalid search request", details: error.issues });
        return;
      }
      send(response, clientStatus(error), { error: error instanceof Error ? error.message : "Search failed" });
    }
  }).listen(port, () => console.log(`Order search listening on http://localhost:${port}`));
}

await main();
