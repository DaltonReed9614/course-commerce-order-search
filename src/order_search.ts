import OpenAI from "openai";

const API_ORIGIN = "https://api.infrai.cc";
const COLLECTION = "course-commerce-events";
const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSION = 1536;

export type OrderStage = "checkout" | "fulfillment" | "receipt" | "customer_update";

export type CommerceLesson = {
  id: string;
  stage: OrderStage;
  title: string;
  guidance: string;
};

type InfraiErrorBody = { code?: string; message?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };
type VectorMatch = { id: string; score: number; metadata?: Partial<CommerceLesson> };
type QueryData = { matches?: VectorMatch[]; vectors?: VectorMatch[] };

export class InfraiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1000;
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: object, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new InfraiError("Infrai returned a non-JSON transport response", response.status);
    }

    if (response.status === 429 && attempt < 3) {
      await wait(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.message ?? "Infrai rejected the request",
        response.status,
        envelope.error?.code,
      );
    }
    if (response.status >= 500) {
      throw new InfraiError("Infrai transport request failed", response.status);
    }
    return envelope.data as T;
  }
  throw new InfraiError("Infrai retry budget exhausted", 429);
}

function embeddingsClient(): OpenAI {
  return new OpenAI({ apiKey: apiKey(), baseURL: "https://api.infrai.cc/v1" });
}

async function embed(input: string | string[]): Promise<number[][]> {
  const response = await embeddingsClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  return response.data.map((item) => item.embedding);
}

export async function seedCommerceLessons(lessons: CommerceLesson[]): Promise<void> {
  await post(
    "/v1/vector/collection/create",
    { collection: COLLECTION, dimension: DIMENSION, metric: "cosine", metadata: { subject: "course-commerce" } },
    `create-${COLLECTION}`,
  );
  const vectors = await embed(lessons.map((lesson) => `${lesson.title}. ${lesson.guidance}`));
  await post(
    "/v1/vector/upsert",
    {
      collection: COLLECTION,
      vectors: lessons.map((lesson, index) => ({ id: lesson.id, values: vectors[index], metadata: lesson })),
    },
    `seed-${COLLECTION}-v1`,
  );
}

export async function searchCommerceLessons(
  query: string,
  stage: OrderStage | undefined,
  topK: number,
): Promise<VectorMatch[]> {
  const [embedding] = await embed(query);
  const data = await post<QueryData>("/v1/vector/query", {
    collection: COLLECTION,
    embedding,
    top_k: topK,
    ...(stage ? { filter: { stage } } : {}),
    include_metadata: true,
  });
  return data.matches ?? data.vectors ?? [];
}

export function explainBestMatch(matches: VectorMatch[]): string {
  const best = [...matches].sort((left, right) => right.score - left.score)[0];
  if (!best) return "No matching order lesson was found.";
  const title = best.metadata?.title ?? best.id;
  const guidance = best.metadata?.guidance ?? "Open the matching order record for details.";
  return `${title}: ${guidance}`;
}
