const ALLOWED_GENRES = [
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "drama",
  "fantasy",
  "horror",
  "mystery",
  "romance",
  "sci-fi",
  "thriller",
] as const;

const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free";

const ALLOWED_MOODS = [
  "easy",
  "emotional",
  "fast",
  "feel-good",
  "funny",
  "mind-bending",
  "tense",
  "thoughtful",
] as const;

const asAllowedList = <T extends readonly string[]>(value: unknown, allowed: T): T[number][] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T[number] => typeof item === "string" && allowed.includes(item as T[number])))];
};

const asNullableNumber = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const extractJson = (content: string) => {
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("No JSON object in model response");
  return JSON.parse(content.slice(first, last + 1)) as Record<string, unknown>;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const text =
      typeof body === "object" && body !== null && "text" in body && typeof body.text === "string"
        ? body.text.trim()
        : "";

    if (!text || text.length > 800) {
      return json({ error: "Provide between 1 and 800 characters." }, 400);
    }

    const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    const apiKey = env.OPENROUTER_API_KEY;
    const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
    if (!apiKey) {
      return json({ error: "AI intent parsing is not configured." }, 503);
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Reel Consensus",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "Extract a movie-night brief into JSON only. Never recommend a title. Allowed genres: action, adventure, animation, comedy, crime, drama, fantasy, horror, mystery, romance, sci-fi, thriller. Allowed moods: easy, emotional, fast, feel-good, funny, mind-bending, tense, thoughtful. Return exactly: {\"likedGenres\":[],\"avoidedGenres\":[],\"moods\":[],\"maxRuntime\":null,\"minRating\":null,\"summary\":\"\"}. maxRuntime is minutes. minRating is 0-10. Hard negatives belong in avoidedGenres. Keep summary under 100 characters.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!upstream.ok) {
      const details = await upstream.text();
      console.error("OpenRouter intent request failed", upstream.status, details.slice(0, 300));
      return json({ error: "AI provider unavailable." }, 502);
    }

    const completion = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return json({ error: "AI provider returned no content." }, 502);

    try {
      const parsed = extractJson(content);
      const summary =
        typeof parsed.summary === "string"
          ? parsed.summary.trim().slice(0, 100)
          : "AI interpreted your shared brief.";

      return json({
        intent: {
          likedGenres: asAllowedList(parsed.likedGenres, ALLOWED_GENRES),
          avoidedGenres: asAllowedList(parsed.avoidedGenres, ALLOWED_GENRES),
          moods: asAllowedList(parsed.moods, ALLOWED_MOODS),
          maxRuntime: asNullableNumber(parsed.maxRuntime, 45, 240),
          minRating: asNullableNumber(parsed.minRating, 0, 10),
          summary,
          source: "ai",
        },
      });
    } catch (error) {
      console.error("Invalid AI intent payload", error);
      return json({ error: "AI response could not be validated." }, 502);
    }
  },
};
