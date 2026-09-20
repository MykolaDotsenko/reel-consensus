import {
  compactCatalogQuery,
  type CatalogResponse,
  type ProviderDirectoryResponse,
} from "../domain/catalog";
import type {
  DecisionSettings,
  Participant,
  PlaybackContext,
  SharedIntent,
} from "../domain/types";

export class CatalogUnavailableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogUnavailableError";
  }
}

const parseError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string"
      ? payload.error
      : "Catalogue request failed.";
  } catch {
    return "Catalogue request failed.";
  }
};

export const fetchProviderDirectory = async (
  region: string,
): Promise<ProviderDirectoryResponse> => {
  const response = await fetch(
    `/api/providers?region=${encodeURIComponent(region)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new CatalogUnavailableError(
      await parseError(response),
      response.status,
    );
  }

  return (await response.json()) as ProviderDirectoryResponse;
};

export const fetchRealCatalog = async ({
  playback,
  settings,
  participants,
  intent,
}: {
  playback: PlaybackContext;
  settings: DecisionSettings;
  participants: Participant[];
  intent: SharedIntent | null;
}): Promise<CatalogResponse> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        compactCatalogQuery({
          playback,
          settings,
          participants,
          intent,
        }),
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CatalogUnavailableError(
        await parseError(response),
        response.status,
      );
    }

    return (await response.json()) as CatalogResponse;
  } finally {
    window.clearTimeout(timeout);
  }
};
