import type {
  Genre,
  MonetizationType,
  Mood,
  Movie,
  MovieAvailability,
  PlaybackContext,
  StreamingProvider,
  CatalogRegion,
} from "../../domain/types";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const TMDB_GENRE_TO_DOMAIN: Record<number, Genre | undefined> = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  18: "drama",
  14: "fantasy",
  27: "horror",
  9648: "mystery",
  10749: "romance",
  878: "sci-fi",
  53: "thriller",
};

const DOMAIN_TO_TMDB_GENRE: Record<Genre, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  drama: 18,
  fantasy: 14,
  horror: 27,
  mystery: 9648,
  romance: 10749,
  "sci-fi": 878,
  thriller: 53,
};

const GENRE_MOODS: Partial<Record<Genre, Mood[]>> = {
  action: ["fast", "tense"],
  adventure: ["fast", "feel-good"],
  animation: ["easy", "feel-good"],
  comedy: ["funny", "easy"],
  crime: ["tense", "thoughtful"],
  drama: ["emotional", "thoughtful"],
  fantasy: ["feel-good", "mind-bending"],
  horror: ["tense"],
  mystery: ["thoughtful", "mind-bending"],
  romance: ["emotional", "feel-good"],
  "sci-fi": ["mind-bending", "thoughtful"],
  thriller: ["tense", "fast"],
};

const KEYWORD_MOODS: Array<{ terms: string[]; moods: Mood[] }> = [
  { terms: ["time travel", "time loop", "parallel world", "multiverse"], moods: ["mind-bending"] },
  { terms: ["satire", "dark comedy"], moods: ["funny", "thoughtful"] },
  { terms: ["friendship", "family", "coming of age"], moods: ["feel-good", "emotional"] },
  { terms: ["investigation", "whodunit", "murder mystery"], moods: ["thoughtful", "tense"] },
  { terms: ["road trip", "buddy"], moods: ["easy", "feel-good"] },
];

const GENRE_PRESENTATION: Partial<Record<Genre, { glyph: string; accent: string }>> = {
  action: { glyph: "⚡", accent: "#ff7a45" },
  adventure: { glyph: "△", accent: "#d9a45c" },
  animation: { glyph: "✦", accent: "#ff6e88" },
  comedy: { glyph: "◡", accent: "#efc24e" },
  crime: { glyph: "▦", accent: "#82a2ad" },
  drama: { glyph: "◇", accent: "#a78bfa" },
  fantasy: { glyph: "✺", accent: "#c285ff" },
  horror: { glyph: "◐", accent: "#d95f6a" },
  mystery: { glyph: "⌕", accent: "#e1b85c" },
  romance: { glyph: "♡", accent: "#e87979" },
  "sci-fi": { glyph: "◌", accent: "#8aa7ff" },
  thriller: { glyph: "□", accent: "#8a929d" },
};

type TmdbKeyword = { id: number; name: string };
type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
  display_priorities?: Record<string, number>;
};

type TmdbWatchRegion = {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};

export type TmdbWatchProviders = {
  results?: Record<string, TmdbWatchRegion>;
};

export type TmdbMovieDetails = {
  id: number;
  title: string;
  release_date?: string;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  poster_path?: string | null;
  genres?: Array<{ id: number; name: string }>;
  keywords?: { keywords?: TmdbKeyword[]; results?: TmdbKeyword[] };
  "watch/providers"?: TmdbWatchProviders;
};

export type TmdbDiscoverMovie = {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
};

export type TmdbDiscoverResponse = {
  page?: number;
  total_pages?: number;
  results?: TmdbDiscoverMovie[];
};

export type TmdbProviderListResponse = {
  results?: TmdbProvider[];
};

export type TmdbRegionListResponse = {
  results?: Array<{
    iso_3166_1: string;
    english_name: string;
    native_name?: string;
  }>;
};

const unique = <T,>(values: T[]) => [...new Set(values)];

export const domainGenreIds = (genres: Genre[]) =>
  genres.map((genre) => DOMAIN_TO_TMDB_GENRE[genre]);

export const mapTmdbGenreIds = (ids: number[]) =>
  unique(ids.map((id) => TMDB_GENRE_TO_DOMAIN[id]).filter((genre): genre is Genre => Boolean(genre)));

export const deriveMoods = (genres: Genre[], keywords: TmdbKeyword[]): Mood[] => {
  const moods = genres.flatMap((genre) => GENRE_MOODS[genre] ?? []);
  const keywordNames = keywords.map((keyword) => keyword.name.toLowerCase());

  for (const rule of KEYWORD_MOODS) {
    if (rule.terms.some((term) => keywordNames.some((name) => name.includes(term)))) {
      moods.push(...rule.moods);
    }
  }

  return unique(moods).slice(0, 4);
};

export const normalizeAvailability = (
  payload: TmdbWatchProviders | undefined,
  playback: PlaybackContext,
): MovieAvailability[] => {
  const regionData = payload?.results?.[playback.region];
  if (!regionData) return [];

  const selectedProviders = new Set(playback.providerIds);
  const rows: MovieAvailability[] = [];
  const seen = new Set<string>();

  for (const monetization of playback.monetization) {
    const providers = regionData[monetization] ?? [];
    for (const provider of providers) {
      if (selectedProviders.size && !selectedProviders.has(provider.provider_id)) continue;
      const key = `${provider.provider_id}:${monetization}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        providerId: provider.provider_id,
        providerName: provider.provider_name,
        monetization,
        region: playback.region,
        source: "tmdb-justwatch",
        sourceUrl: regionData.link ?? null,
      });
    }
  }

  return rows;
};

export const normalizeTmdbMovie = (
  details: TmdbMovieDetails,
  playback: PlaybackContext,
): Movie | null => {
  const runtime = details.runtime ?? 0;
  if (runtime <= 0) return null;

  const genres = mapTmdbGenreIds((details.genres ?? []).map((genre) => genre.id));
  if (!genres.length) return null;

  const keywords = details.keywords?.keywords ?? details.keywords?.results ?? [];
  const availability = normalizeAvailability(details["watch/providers"], playback);

  if (playback.requireAvailability && !availability.length) return null;

  const primaryGenre = genres[0];
  const presentation = (primaryGenre && GENRE_PRESENTATION[primaryGenre]) ?? {
    glyph: "◈",
    accent: "#a78bfa",
  };

  return {
    id: `tmdb-${details.id}`,
    title: details.title,
    year: Number.parseInt(details.release_date?.slice(0, 4) ?? "", 10) || 0,
    runtime,
    rating: Math.round((details.vote_average ?? 0) * 10) / 10,
    voteCount: details.vote_count ?? 0,
    genres,
    moods: deriveMoods(genres, keywords),
    summary: details.overview?.trim() || "No synopsis available.",
    glyph: presentation.glyph,
    accent: presentation.accent,
    externalIds: [{ source: "tmdb", id: String(details.id) }],
    posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : null,
    availability,
    source: "tmdb",
  };
};

export const normalizeProviders = (
  payload: TmdbProviderListResponse,
  region: string,
): StreamingProvider[] =>
  (payload.results ?? [])
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoUrl: provider.logo_path ? `${TMDB_IMAGE_BASE}${provider.logo_path}` : null,
      displayPriority:
        provider.display_priorities?.[region] ??
        provider.display_priority ??
        Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.displayPriority - right.displayPriority || left.name.localeCompare(right.name));

export const normalizeRegions = (payload: TmdbRegionListResponse): CatalogRegion[] =>
  (payload.results ?? [])
    .map((region) => ({
      code: region.iso_3166_1.toUpperCase(),
      name: region.english_name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

export const tmdbFetch = async <T>({
  token,
  path,
  params = {},
  timeoutMs = 7000,
}: {
  token: string;
  path: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
}): Promise<T> => {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`TMDB ${response.status}: ${details.slice(0, 180)}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};
