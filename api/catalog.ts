import {
  effectiveRatingFloor,
  effectiveRuntimeLimit,
  excludedGenres,
  requestedGenres,
  type CatalogQuery,
} from "../src/domain/catalog";
import {
  GENRES,
  type Genre,
  type MonetizationType,
  type Movie,
  type PlaybackContext,
} from "../src/domain/types";
import {
  domainGenreIds,
  normalizeTmdbMovie,
  tmdbFetch,
  type TmdbDiscoverResponse,
  type TmdbMovieDetails,
  type TmdbWatchProviders,
} from "../src/lib/server/tmdb";

const ALLOWED_MONETIZATION: MonetizationType[] = [
  "flatrate",
  "free",
  "ads",
  "rent",
  "buy",
];

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const getEnv = () =>
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const asGenreList = (value: unknown): Genre[] => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is Genre =>
          typeof item === "string" && GENRES.includes(item as Genre),
      ),
    ),
  ].slice(0, GENRES.length);
};

const asNullableNumber = (
  value: unknown,
  min: number,
  max: number,
): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
};

const parsePlayback = (value: unknown): PlaybackContext | null => {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const region =
    typeof raw.region === "string" ? raw.region.toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(region)) return null;

  const providerIds = Array.isArray(raw.providerIds)
    ? [
        ...new Set(
          raw.providerIds
            .map((item) => Number(item))
            .filter(
              (item) =>
                Number.isInteger(item) && item > 0 && item < 1_000_000,
            ),
        ),
      ].slice(0, 20)
    : [];

  const monetization = Array.isArray(raw.monetization)
    ? [
        ...new Set(
          raw.monetization.filter(
            (item): item is MonetizationType =>
              typeof item === "string" &&
              ALLOWED_MONETIZATION.includes(item as MonetizationType),
          ),
        ),
      ]
    : [];

  return {
    region,
    providerIds,
    monetization: monetization.length
      ? monetization
      : ["flatrate", "free", "ads"],
    requireAvailability: raw.requireAvailability !== false,
  };
};

const parseCatalogQuery = (body: unknown): CatalogQuery | null => {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;
  const playback = parsePlayback(raw.playback);
  if (!playback) return null;

  const settingsRaw =
    typeof raw.settings === "object" && raw.settings !== null
      ? (raw.settings as Record<string, unknown>)
      : {};

  const participantRows = Array.isArray(raw.participants)
    ? raw.participants.slice(0, 5)
    : [];
  const participants = participantRows.map((participant) => {
    const item =
      typeof participant === "object" && participant !== null
        ? (participant as Record<string, unknown>)
        : {};
    return {
      likedGenres: asGenreList(item.likedGenres),
      avoidedGenres: asGenreList(item.avoidedGenres),
    };
  });

  const intentRaw =
    typeof raw.intent === "object" && raw.intent !== null
      ? (raw.intent as Record<string, unknown>)
      : null;

  return {
    playback,
    settings: {
      maxRuntime: asNullableNumber(settingsRaw.maxRuntime, 30, 360),
      minRating: asNullableNumber(settingsRaw.minRating, 0, 10),
      excludedGenres: asGenreList(settingsRaw.excludedGenres),
    },
    participants,
    intent: intentRaw
      ? {
          likedGenres: asGenreList(intentRaw.likedGenres),
          avoidedGenres: asGenreList(intentRaw.avoidedGenres),
          maxRuntime: asNullableNumber(intentRaw.maxRuntime, 30, 360),
          minRating: asNullableNumber(intentRaw.minRating, 0, 10),
        }
      : null,
  };
};

const mapLimit = async <T, R>(
  values: T[],
  limit: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(values[index]!);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(limit, values.length) },
      () => worker(),
    ),
  );
  return results;
};

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    const token = getEnv().TMDB_ACCESS_TOKEN?.trim();
    if (!token) {
      return json({ error: "Real catalogue is not configured." }, 503);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const query = parseCatalogQuery(body);
    if (!query) {
      return json({ error: "Invalid catalogue query." }, 400);
    }

    const wantedGenres = domainGenreIds(requestedGenres(query));
    const vetoGenreIds = new Set(domainGenreIds(excludedGenres(query)));
    const maxRuntime = effectiveRuntimeLimit(query);
    const minRating = effectiveRatingFloor(query);
    const providerIds = query.playback.providerIds.join("|");
    const monetization = query.playback.monetization.join("|");

    const discoverParams = {
      language: "en-US",
      include_adult: false,
      include_video: false,
      sort_by: "popularity.desc",
      watch_region: query.playback.requireAvailability
        ? query.playback.region
        : undefined,
      with_watch_monetization_types: query.playback.requireAvailability
        ? monetization
        : undefined,
      with_watch_providers:
        query.playback.requireAvailability && providerIds
          ? providerIds
          : undefined,
      with_genres: wantedGenres.length ? wantedGenres.join("|") : undefined,
      "with_runtime.lte": maxRuntime,
      "vote_average.gte": minRating,
      "vote_count.gte": 60,
    };

    try {
      const pages = await Promise.all(
        [1, 2].map((page) =>
          tmdbFetch<TmdbDiscoverResponse>({
            token,
            path: "/discover/movie",
            params: { ...discoverParams, page },
          }),
        ),
      );

      const seen = new Set<number>();
      const discovered = pages
        .flatMap((page) => page.results ?? [])
        .filter((movie) => {
          if (seen.has(movie.id)) return false;
          seen.add(movie.id);
          return !(movie.genre_ids ?? []).some((genreId) =>
            vetoGenreIds.has(genreId),
          );
        })
        .slice(0, 22);

      const normalized = await mapLimit(discovered, 5, async (candidate) => {
        try {
          const details = await tmdbFetch<TmdbMovieDetails>({
            token,
            path: `/movie/${candidate.id}`,
            params: {
              language: "en-US",
              append_to_response: "keywords,watch/providers",
            },
          });

          if (
            query.playback.requireAvailability &&
            !details["watch/providers"]?.results
          ) {
            details["watch/providers"] =
              await tmdbFetch<TmdbWatchProviders>({
                token,
                path: `/movie/${candidate.id}/watch/providers`,
              });
          }

          const movie = normalizeTmdbMovie(details, query.playback);
          if (!movie) return null;
          if (maxRuntime !== null && movie.runtime > maxRuntime) return null;
          if (minRating !== null && movie.rating < minRating) return null;
          if (
            movie.genres.some((genre) =>
              excludedGenres(query).includes(genre),
            )
          ) {
            return null;
          }
          return movie;
        } catch (error) {
          console.warn("Skipping TMDB candidate", candidate.id, error);
          return null;
        }
      });

      const movies = normalized
        .filter((movie): movie is Movie => movie !== null)
        .slice(0, 18);

      return json({
        movies,
        source: "tmdb",
        region: query.playback.region,
        candidateCount: discovered.length,
        availabilityFiltered: query.playback.requireAvailability,
      });
    } catch (error) {
      console.error("TMDB catalogue request failed", error);
      return json({ error: "Real catalogue is temporarily unavailable." }, 502);
    }
  },
};
