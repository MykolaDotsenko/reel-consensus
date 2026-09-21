const getEnv = () =>
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const configured = (value: string | undefined) => Boolean(value?.trim());

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    }

    const env = getEnv();

    return Response.json(
      {
        status: "ok",
        service: "reel-consensus",
        commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
        environment: env.VERCEL_ENV ?? null,
        region: env.VERCEL_REGION ?? null,
        capabilities: {
          tmdb: configured(env.TMDB_ACCESS_TOKEN),
          openrouter: configured(env.OPENROUTER_API_KEY),
          sharedRooms:
            configured(env.VITE_SUPABASE_URL) &&
            configured(env.VITE_SUPABASE_ANON_KEY),
        },
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  },
};
