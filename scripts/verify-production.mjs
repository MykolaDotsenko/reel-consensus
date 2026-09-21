const args = process.argv.slice(2);

const valueFor = (name) => {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const boolFor = (name) => {
  const value = valueFor(name);
  return value === "true" || value === "1";
};

const baseUrl = (valueFor("url") ?? process.env.PRODUCTION_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Missing production URL. Use --url https://example.vercel.app");
  process.exit(1);
}

const requireLiveCatalog = boolFor("require-live-catalog");
const requireSharedRooms = boolFor("require-shared-rooms");
const timeoutMs = 12_000;

const fetchChecked = async (path, init) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return { url, response };
};

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

const pass = (message) => console.log(`✓ ${message}`);
const info = (message) => console.log(`• ${message}`);

try {
  const root = await fetch(baseUrl, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await root.text();
  if (!root.ok || !html.includes("Reel Consensus")) {
    fail(`Root page failed (${root.status})`);
  } else {
    pass("Root page serves Reel Consensus");
  }

  const { response: healthResponse } = await fetchChecked("/api/health");
  if (!healthResponse.ok) {
    fail(`Health endpoint failed (${healthResponse.status})`);
    process.exit();
  }

  const health = await healthResponse.json();
  if (health?.status !== "ok" || health?.service !== "reel-consensus") {
    fail("Health endpoint returned an unexpected payload");
    process.exit();
  }

  pass(
    `Health OK · env=${health.environment ?? "unknown"} · commit=${health.commit ?? "unknown"}`,
  );

  const capabilities = health.capabilities ?? {};
  info(
    `Capabilities · TMDB=${Boolean(capabilities.tmdb)} · rooms=${Boolean(
      capabilities.sharedRooms,
    )} · OpenRouter=${Boolean(capabilities.openrouter)}`,
  );

  if (requireLiveCatalog && !capabilities.tmdb) {
    fail("TMDB is required but not configured");
  }

  if (requireSharedRooms && !capabilities.sharedRooms) {
    fail("Shared rooms are required but Supabase public env is not configured");
  }

  if (capabilities.tmdb) {
    const { response: providersResponse } = await fetchChecked(
      "/api/providers?region=FI",
    );
    if (!providersResponse.ok) {
      fail(`Finland provider directory failed (${providersResponse.status})`);
    } else {
      const providers = await providersResponse.json();
      if (
        providers?.source !== "tmdb" ||
        !Array.isArray(providers.providers) ||
        providers.providers.length === 0
      ) {
        fail("Finland provider directory returned no usable providers");
      } else {
        pass(
          `Finland provider directory live · ${providers.providers.length} providers`,
        );
      }
    }

    const { response: catalogResponse } = await fetchChecked("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playback: {
          region: "FI",
          providerIds: [],
          monetization: ["flatrate", "free", "ads"],
          requireAvailability: true,
        },
        settings: {
          maxRuntime: 150,
          minRating: 6.5,
          excludedGenres: ["horror"],
        },
        participants: [
          {
            likedGenres: ["comedy", "sci-fi"],
            avoidedGenres: ["horror"],
          },
          {
            likedGenres: ["mystery", "comedy"],
            avoidedGenres: [],
          },
        ],
        intent: null,
      }),
    });

    if (!catalogResponse.ok) {
      fail(`Finland live catalogue failed (${catalogResponse.status})`);
    } else {
      const catalog = await catalogResponse.json();
      const movies = Array.isArray(catalog?.movies) ? catalog.movies : [];
      const invalid = movies.filter(
        (movie) =>
          !Array.isArray(movie.availability) ||
          movie.availability.length === 0 ||
          movie.availability.some((row) => row.region !== "FI"),
      );

      if (catalog?.source !== "tmdb" || catalog?.region !== "FI") {
        fail("Live catalogue returned an unexpected source or region");
      } else if (invalid.length) {
        fail(`${invalid.length} live movies violate availability invariants`);
      } else {
        pass(
          `Finland catalogue live · ${movies.length} watchable candidates returned`,
        );
        if (movies.length === 0) {
          info(
            "Zero candidates is not automatically a failure: the live API responded correctly but current constraints may be too strict.",
          );
        }
      }
    }
  } else {
    info("TMDB smoke skipped because live catalogue is not configured");
  }

  if (capabilities.sharedRooms) {
    pass("Supabase public room configuration is present in the deployment");
    info(
      "Database migration + anonymous-auth behavior still require a real browser room test after Supabase is connected.",
    );
  } else {
    info("Shared-room live smoke skipped because Supabase env is not configured");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (process.exitCode) {
  console.error("\nProduction verification FAILED");
} else {
  console.log("\nProduction verification PASSED");
}
