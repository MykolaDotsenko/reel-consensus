import { parseIntentLocally } from "../domain/intentParser";
import type { SharedIntent } from "../domain/types";

export type IntentResult = {
  intent: SharedIntent;
  usedFallback: boolean;
};

export const interpretIntent = async (text: string): Promise<IntentResult> => {
  const fallback = parseIntentLocally(text);
  if (!text.trim()) return { intent: fallback, usedFallback: true };

  try {
    const response = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return { intent: fallback, usedFallback: true };
    const payload = (await response.json()) as { intent?: SharedIntent };
    if (!payload.intent) return { intent: fallback, usedFallback: true };

    return { intent: { ...payload.intent, source: "ai" }, usedFallback: false };
  } catch {
    return { intent: fallback, usedFallback: true };
  }
};
