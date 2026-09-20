import { useEffect, useMemo, useState } from "react";
import type {
  CatalogRegion,
  MonetizationType,
  PlaybackContext,
  StreamingProvider,
} from "../domain/types";
import { fetchProviderDirectory } from "../lib/catalogClient";

type AvailabilityStatus = "loading" | "ready" | "unavailable";

type Props = {
  value: PlaybackContext;
  onChange: (value: PlaybackContext) => void;
  onCatalogueStatusChange: (available: boolean) => void;
};

const INCLUDED_TYPES: MonetizationType[] = ["flatrate", "free", "ads"];

const toggleProvider = (values: number[], value: number) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const toggleMonetization = (
  values: MonetizationType[],
  value: MonetizationType,
) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

export function AvailabilityPanel({
  value,
  onChange,
  onCatalogueStatusChange,
}: Props) {
  const [status, setStatus] = useState<AvailabilityStatus>("loading");
  const [regions, setRegions] = useState<CatalogRegion[]>([]);
  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage(null);

    void fetchProviderDirectory(value.region)
      .then((directory) => {
        if (cancelled) return;
        setRegions(directory.regions);
        setProviders(directory.providers);
        setStatus("ready");
        onCatalogueStatusChange(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProviders([]);
        setStatus("unavailable");
        setMessage("Demo catalogue active until TMDB is configured.");
        onCatalogueStatusChange(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onCatalogueStatusChange, value.region]);

  const popularProviders = useMemo(() => providers.slice(0, 10), [providers]);
  const moreProviders = useMemo(() => providers.slice(10), [providers]);

  const includedActive = INCLUDED_TYPES.every((type) =>
    value.monetization.includes(type),
  );

  const toggleIncluded = () => {
    const remaining = value.monetization.filter(
      (type) => !INCLUDED_TYPES.includes(type),
    );
    onChange({
      ...value,
      monetization: includedActive
        ? remaining
        : [...new Set([...remaining, ...INCLUDED_TYPES])],
    });
  };

  return (
    <section className="availability-card" aria-labelledby="availability-heading">
      <div className="availability-card__heading">
        <div>
          <div className="card-eyebrow">
            <span className="eyebrow-icon" aria-hidden="true">◉</span>
            Watchable tonight
          </div>
          <h2 id="availability-heading">Only rank movies you can actually play.</h2>
          <p>
            Availability is a hard filter before group scoring. Country and services are
            always explicit and editable.
          </p>
        </div>
        <span
          className={
            status === "ready"
              ? "catalog-status catalog-status--ready"
              : "catalog-status"
          }
        >
          {status === "loading"
            ? "Checking catalogue…"
            : status === "ready"
              ? "Live catalogue"
              : "Demo catalogue"}
        </span>
      </div>

      <div className="availability-grid">
        <label className="country-field">
          <span>Country</span>
          <select
            value={value.region}
            disabled={status !== "ready"}
            onChange={(event) =>
              onChange({
                ...value,
                region: event.target.value,
                providerIds: [],
              })
            }
          >
            {regions.length ? (
              regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))
            ) : (
              <option value={value.region}>{value.region}</option>
            )}
          </select>
        </label>

        <fieldset className="availability-options">
          <legend>Ways to watch</legend>
          <div className="availability-option-row">
            <button
              type="button"
              aria-pressed={includedActive}
              className={
                includedActive
                  ? "preference-chip preference-chip--active"
                  : "preference-chip"
              }
              disabled={status !== "ready"}
              onClick={toggleIncluded}
            >
              Included / free
            </button>
            {(["rent", "buy"] as MonetizationType[]).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={value.monetization.includes(type)}
                className={
                  value.monetization.includes(type)
                    ? "preference-chip preference-chip--active"
                    : "preference-chip"
                }
                disabled={status !== "ready"}
                onClick={() =>
                  onChange({
                    ...value,
                    monetization: toggleMonetization(
                      value.monetization,
                      type,
                    ),
                  })
                }
              >
                {type === "rent" ? "Rent" : "Buy"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {status === "ready" ? (
        <div className="provider-picker">
          <div className="provider-picker__label">
            <span>Your services</span>
            <small>
              {value.providerIds.length
                ? `${value.providerIds.length} selected`
                : "Any service in this country"}
            </small>
          </div>

          <div className="provider-chip-row">
            <button
              type="button"
              className={
                value.providerIds.length === 0
                  ? "provider-chip provider-chip--active"
                  : "provider-chip"
              }
              aria-pressed={value.providerIds.length === 0}
              onClick={() => onChange({ ...value, providerIds: [] })}
            >
              Any service
            </button>
            {popularProviders.map((provider) => {
              const active = value.providerIds.includes(provider.id);
              return (
                <button
                  key={provider.id}
                  type="button"
                  className={
                    active
                      ? "provider-chip provider-chip--active"
                      : "provider-chip"
                  }
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...value,
                      providerIds: toggleProvider(
                        value.providerIds,
                        provider.id,
                      ),
                    })
                  }
                >
                  {provider.name}
                </button>
              );
            })}
          </div>

          {moreProviders.length ? (
            <details className="provider-more">
              <summary>More streaming services</summary>
              <div className="provider-chip-row">
                {moreProviders.map((provider) => {
                  const active = value.providerIds.includes(provider.id);
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className={
                        active
                          ? "provider-chip provider-chip--active"
                          : "provider-chip"
                      }
                      aria-pressed={active}
                      onClick={() =>
                        onChange({
                          ...value,
                          providerIds: toggleProvider(
                            value.providerIds,
                            provider.id,
                          ),
                        })
                      }
                    >
                      {provider.name}
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="availability-card__message" role="status">
          {message ?? "Checking real movie availability…"}
        </p>
      )}

      <p className="availability-attribution">
        Streaming availability data: JustWatch via TMDB. Availability can change.
      </p>
    </section>
  );
}
