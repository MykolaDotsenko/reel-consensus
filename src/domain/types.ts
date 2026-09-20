export const GENRES = [
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

export const MOODS = [
  "easy",
  "emotional",
  "fast",
  "feel-good",
  "funny",
  "mind-bending",
  "tense",
  "thoughtful",
] as const;

export type Genre = (typeof GENRES)[number];
export type Mood = (typeof MOODS)[number];
export type FairnessMode = "balanced" | "democratic" | "no-one-hates-it";

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  rating: number;
  genres: Genre[];
  moods: Mood[];
  summary: string;
  glyph: string;
  accent: string;
};

export type Participant = {
  id: string;
  name: string;
  likedGenres: Genre[];
  avoidedGenres: Genre[];
  moods: Mood[];
};

export type SharedIntent = {
  likedGenres: Genre[];
  avoidedGenres: Genre[];
  moods: Mood[];
  maxRuntime: number | null;
  minRating: number | null;
  summary: string;
  source: "ai" | "local";
};

export type DecisionSettings = {
  maxRuntime: number | null;
  minRating: number | null;
  excludedGenres: Genre[];
  fairnessMode: FairnessMode;
};

export type ParticipantScore = {
  participantId: string;
  name: string;
  score: number;
  matchedGenres: Genre[];
  matchedMoods: Mood[];
};

export type RankedMovie = {
  movie: Movie;
  groupScore: number;
  meanScore: number;
  minimumScore: number;
  disagreement: number;
  participantScores: ParticipantScore[];
  reasons: string[];
  tradeoffs: string[];
};
