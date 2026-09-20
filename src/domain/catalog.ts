import type {
  CatalogRegion,
  DecisionSettings,
  Genre,
  Movie,
  MonetizationType,
  Participant,
  PlaybackContext,
  SharedIntent,
  StreamingProvider,
} from "./types";

export type CatalogQuery = {
  playback: PlaybackContext;
  settings: Pick<DecisionSettings, "maxRuntime" | "minRating" | "excludedGenres">;
  participants: Array<Pick<Participant, "likedGenres" | "avoidedGenres">>;
  intent: Pick<SharedIntent, "likedGenres" | "avoidedGenres" | "maxRuntime" | "minRating"> | null;
};

export type CatalogResponse = {
  movies: Movie[];
  source: "tmdb";
  region: string;
  candidateCount: number;
  availabilityFiltered: boolean;
};

export type ProviderDirectoryResponse = {
  source: "tmdb";
  regions: CatalogRegion[];
  providers: StreamingProvider[];
};

export const DEFAULT_MONETIZATION: MonetizationType[] = ["flatrate", "free", "ads"];

export const inferRegionFromLocale = (locale: string | undefined) => {
  if (!locale) return "US";

  try {
    return new Intl.Locale(locale).region?.toUpperCase() ?? "US";
  } catch {
    const match = locale.match(/[-_]([A-Za-z]{2})$/);
    return match?.[1]?.toUpperCase() ?? "US";
  }
};

export const makeInitialPlaybackContext = (
  locale: string | undefined,
): PlaybackContext => ({
  region: inferRegionFromLocale(locale),
  providerIds: [],
  monetization: [...DEFAULT_MONETIZATION],
  requireAvailability: true,
});

export const compactCatalogQuery = ({
  playback,
  settings,
  participants,
  intent,
}: {
  playback: PlaybackContext;
  settings: DecisionSettings;
  participants: Participant[];
  intent: SharedIntent | null;
}): CatalogQuery => ({
  playback,
  settings: {
    maxRuntime: settings.maxRuntime,
    minRating: settings.minRating,
    excludedGenres: settings.excludedGenres,
  },
  participants: participants.map(({ likedGenres, avoidedGenres }) => ({
    likedGenres,
    avoidedGenres,
  })),
  intent: intent
    ? {
        likedGenres: intent.likedGenres,
        avoidedGenres: intent.avoidedGenres,
        maxRuntime: intent.maxRuntime,
        minRating: intent.minRating,
      }
    : null,
});

export const requestedGenres = (query: CatalogQuery): Genre[] => [
  ...new Set([
    ...query.participants.flatMap((participant) => participant.likedGenres),
    ...(query.intent?.likedGenres ?? []),
  ]),
];

export const excludedGenres = (query: CatalogQuery): Genre[] => [
  ...new Set([
    ...query.settings.excludedGenres,
    ...query.participants.flatMap((participant) => participant.avoidedGenres),
    ...(query.intent?.avoidedGenres ?? []),
  ]),
];

export const effectiveRuntimeLimit = (query: CatalogQuery) => {
  const values = [query.settings.maxRuntime, query.intent?.maxRuntime ?? null].filter(
    (value): value is number => value !== null,
  );
  return values.length ? Math.min(...values) : null;
};

export const effectiveRatingFloor = (query: CatalogQuery) => {
  const values = [query.settings.minRating, query.intent?.minRating ?? null].filter(
    (value): value is number => value !== null,
  );
  return values.length ? Math.max(...values) : null;
};
