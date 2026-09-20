import {
  normalizeProviders,
  normalizeRegions,
  tmdbFetch,
  type TmdbProviderListResponse,
  type TmdbRegionListResponse,
} from "../src/lib/server/tmdb";

const json = (
  body: unknown,
  status = 200,
  cacheControl = "no-store",
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": cacheControl },
  });

const getEnv = () =>
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    }

    const token = getEnv().TMDB_ACCESS_TOKEN?.trim();
    if (!token) {
      return json({ error: "Real catalogue is not configured." }, 503);
    }

    const requestUrl = new URL(request.url);
    const region = (requestUrl.searchParams.get("region") ?? "US").toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) {
      return json({ error: "region must be an ISO 3166-1 alpha-2 code." }, 400);
    }

    try {
      const [regionPayload, providerPayload] = await Promise.all([
        tmdbFetch<TmdbRegionListResponse>({
          token,
          path: "/watch/providers/regions",
          params: { language: "en-US" },
        }),
        tmdbFetch<TmdbProviderListResponse>({
          token,
          path: "/watch/providers/movie",
          params: { language: "en-US", watch_region: region },
        }),
      ]);

      return json(
        {
          source: "tmdb",
          regions: normalizeRegions(regionPayload),
          providers: normalizeProviders(providerPayload, region),
        },
        200,
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
    } catch (error) {
      console.error("TMDB provider directory failed", error);
      return json({ error: "Streaming provider data is temporarily unavailable." }, 502);
    }
  },
};
