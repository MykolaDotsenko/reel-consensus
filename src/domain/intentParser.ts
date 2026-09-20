import { GENRES, MOODS, type Genre, type Mood, type SharedIntent } from "./types";

const genreAliases: Record<Genre, string[]> = {
  action: ["action", "explosive", "fight", "fights"],
  adventure: ["adventure", "adventurous", "quest"],
  animation: ["animation", "animated", "cartoon"],
  comedy: ["comedy", "funny", "laugh", "lighthearted"],
  crime: ["crime", "detective", "caper"],
  drama: ["drama", "dramatic"],
  fantasy: ["fantasy", "magic", "magical"],
  horror: ["horror", "scary", "terrifying"],
  mystery: ["mystery", "whodunit", "detective"],
  romance: ["romance", "romantic", "love story"],
  "sci-fi": ["sci-fi", "science fiction", "space", "future"],
  thriller: ["thriller", "suspense", "suspenseful"],
};

const moodAliases: Record<Mood, string[]> = {
  easy: ["easy", "light", "relaxed", "chill", "not heavy"],
  emotional: ["emotional", "moving", "tearjerker", "heartfelt"],
  fast: ["fast", "fast-paced", "energetic", "pacey"],
  "feel-good": ["feel good", "feel-good", "uplifting", "warm"],
  funny: ["fun", "funny", "laugh", "hilarious", "comedy"],
  "mind-bending": ["mind-bending", "mind blowing", "mind-blowing", "twisty", "weird"],
  tense: ["tense", "intense", "suspenseful", "edge of my seat"],
  thoughtful: ["thoughtful", "smart", "clever", "make me think", "intelligent"],
};

const hasAny = (text: string, values: string[]) => values.some((value) => text.includes(value));

const mentionsNegationNear = (text: string, phrase: string) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:no|not|without|avoid|skip|anything but)\\s+(?:\\w+\\s+){0,2}${escaped}`, "i").test(text);
};

const parseRuntime = (text: string) => {
  const hours = text.match(/(?:under|max(?:imum)?|less than|no more than)\s*(\d(?:\.\d)?)\s*h(?:ours?)?/i);
  if (hours?.[1]) return Math.round(Number(hours[1]) * 60);

  const minutes = text.match(/(?:under|max(?:imum)?|less than|no more than)\s*(\d{2,3})\s*(?:min|mins|minutes)/i);
  if (minutes?.[1]) return Number(minutes[1]);

  if (/\b90\s*(?:min|mins|minutes)?\b/i.test(text)) return 90;
  if (/\b2\s*hours?\b/i.test(text)) return 120;
  return null;
};

const parseMinRating = (text: string) => {
  const explicit = text.match(/(?:rated?|rating)\s*(?:at least|above|over|>=?)?\s*(\d(?:\.\d)?)/i);
  if (explicit?.[1]) return Math.min(9.5, Math.max(0, Number(explicit[1])));
  if (/well[- ]rated|highly[- ]rated|great reviews/i.test(text)) return 7.5;
  return null;
};

export const parseIntentLocally = (rawText: string): SharedIntent => {
  const text = rawText.trim().toLowerCase();
  const likedGenres: Genre[] = [];
  const avoidedGenres: Genre[] = [];
  const moods: Mood[] = [];

  for (const genre of GENRES) {
    const aliases = genreAliases[genre];
    if (!hasAny(text, aliases)) continue;
    if (aliases.some((alias) => mentionsNegationNear(text, alias))) avoidedGenres.push(genre);
    else likedGenres.push(genre);
  }

  for (const mood of MOODS) {
    if (hasAny(text, moodAliases[mood])) moods.push(mood);
  }

  const unique = <T,>(values: T[]) => [...new Set(values)];
  const maxRuntime = parseRuntime(text);
  const minRating = parseMinRating(text);
  const summaryParts = [
    likedGenres.length ? `prefer ${unique(likedGenres).join(", ")}` : null,
    avoidedGenres.length ? `avoid ${unique(avoidedGenres).join(", ")}` : null,
    moods.length ? `mood: ${unique(moods).join(", ")}` : null,
    maxRuntime ? `≤ ${maxRuntime} min` : null,
    minRating ? `rating ≥ ${minRating}` : null,
  ].filter(Boolean);

  return {
    likedGenres: unique(likedGenres),
    avoidedGenres: unique(avoidedGenres),
    moods: unique(moods),
    maxRuntime,
    minRating,
    summary: summaryParts.length ? summaryParts.join(" · ") : "No strong constraints detected.",
    source: "local",
  };
};
