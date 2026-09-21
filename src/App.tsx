import { useCallback, useMemo, useRef, useState } from "react";
import { AvailabilityPanel } from "./components/AvailabilityPanel";
import { IntentComposer } from "./components/IntentComposer";
import { ParticipantCard } from "./components/ParticipantCard";
import { ResultCard } from "./components/ResultCard";
import { RoomControls } from "./components/RoomControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { MOVIES } from "./data/movies";
import { makeInitialPlaybackContext } from "./domain/catalog";
import { rankMovies } from "./domain/decisionEngine";
import type {
  DecisionSettings,
  Movie,
  Participant,
  PlaybackContext,
  SharedIntent,
} from "./domain/types";
import { fetchRealCatalog } from "./lib/catalogClient";
import { interpretIntent } from "./lib/interpretIntent";
import { trackProductEvent } from "./lib/productEvents";
import { useSharedRoom } from "./hooks/useSharedRoom";

const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: "you",
    name: "You",
    likedGenres: ["sci-fi", "action"],
    avoidedGenres: [],
    moods: ["mind-bending", "fast"],
  },
  {
    id: "partner",
    name: "Partner",
    likedGenres: ["mystery", "comedy"],
    avoidedGenres: ["horror"],
    moods: ["easy", "funny"],
  },
];

const INITIAL_SETTINGS: DecisionSettings = {
  maxRuntime: 120,
  minRating: 7,
  excludedGenres: [],
  fairnessMode: "balanced",
};

const FAIRNESS_LABELS: Record<DecisionSettings["fairnessMode"], string> = {
  balanced: "Balanced",
  "no-one-hates-it": "Protect everyone",
  democratic: "Majority wins",
};

const makeParticipant = (number: number): Participant => ({
  id: `guest-${number}-${Date.now()}`,
  name: `Guest ${number}`,
  likedGenres: [],
  avoidedGenres: [],
  moods: [],
});

const participantInitials = (name: string, index: number) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return String(index + 1);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
};

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [settings, setSettings] = useState<DecisionSettings>(INITIAL_SETTINGS);
  const [playback, setPlayback] = useState<PlaybackContext>(() =>
    makeInitialPlaybackContext(
      typeof navigator === "undefined" ? undefined : navigator.language,
    ),
  );
  const [catalogMovies, setCatalogMovies] = useState<Movie[]>(MOVIES);
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const [catalogMode, setCatalogMode] = useState<
    "demo" | "loading" | "live" | "fallback"
  >("demo");
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const [brief, setBrief] = useState("Something clever and fun, no horror, under 2 hours.");
  const [intent, setIntent] = useState<SharedIntent | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const applyRemoteParticipants = useCallback((next: Participant[]) => {
    setParticipants(next);
  }, []);
  const applyRemoteSettings = useCallback((next: DecisionSettings) => {
    setSettings(next);
  }, []);
  const applyRemotePlayback = useCallback((next: PlaybackContext) => {
    setPlayback(next);
  }, []);
  const applyRemoteBrief = useCallback((next: string) => {
    setBrief(next);
  }, []);

  const sharedRoom = useSharedRoom({
    participant: participants[0] ?? INITIAL_PARTICIPANTS[0]!,
    settings,
    playback,
    brief,
    onRemoteParticipants: applyRemoteParticipants,
    onRemoteSettings: applyRemoteSettings,
    onRemotePlayback: applyRemotePlayback,
    onRemoteBrief: applyRemoteBrief,
  });

  const ranked = useMemo(
    () =>
      rankMovies({
        movies: catalogMovies,
        participants,
        settings,
        intent,
        dismissedIds,
      }),
    [catalogMovies, participants, settings, intent, dismissedIds],
  );

  const visibleResults = useMemo(() => {
    if (!featuredId) return ranked.slice(0, 3);
    const featured = ranked.find((result) => result.movie.id === featuredId);
    if (!featured) return ranked.slice(0, 3);
    return [featured, ...ranked.filter((result) => result.movie.id !== featuredId)].slice(0, 3);
  }, [featuredId, ranked]);

  const activePeople = participants.filter((participant) => participant.name.trim());
  const runtimeLabel = settings.maxRuntime ? `≤ ${settings.maxRuntime} min` : "Any runtime";
  const ratingLabel = settings.minRating ? `★ ${settings.minRating.toFixed(1)}+` : "Any rating";

  const updateParticipant = (participant: Participant) => {
    setParticipants((current) =>
      current.map((item) => (item.id === participant.id ? participant : item)),
    );

    if (sharedRoom.room && participant.id === sharedRoom.selfUserId) {
      void sharedRoom.syncSelfParticipant(participant);
    }
  };

  const updateSettings = (nextSettings: DecisionSettings) => {
    setSettings(nextSettings);
    if (sharedRoom.room) {
      void sharedRoom.syncRoomConfig(nextSettings, brief);
    }
  };

  const updatePlayback = (nextPlayback: PlaybackContext) => {
    setPlayback(nextPlayback);
    setCatalogMovies(MOVIES);
    setCatalogMode("demo");
    setCatalogMessage(null);
    if (sharedRoom.room) {
      void sharedRoom.syncPlaybackContext(nextPlayback);
    }
  };

  const interpretBrief = async () => {
    setIsInterpreting(true);
    try {
      const { intent: interpreted } = await interpretIntent(brief);
      setIntent(interpreted);
      if (sharedRoom.room) {
        void sharedRoom.syncRoomConfig(settings, brief);
      }
    } finally {
      setIsInterpreting(false);
    }
  };

  const scrollToResults = () => {
    requestAnimationFrame(() => {
      const element = resultsRef.current;
      if (element && typeof element.scrollIntoView === "function") {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const loadCandidatePool = async () => {
    if (!catalogAvailable) {
      return {
        movies: MOVIES,
        mode: "demo" as const,
        message: "Demo catalogue · configure TMDB for live availability.",
      };
    }

    setCatalogMode("loading");
    try {
      const response = await fetchRealCatalog({
        playback,
        settings,
        participants,
        intent,
      });
      return {
        movies: response.movies,
        mode: "live" as const,
        message: `Live catalogue · ${response.region} · ${response.movies.length} watchable candidates`,
      };
    } catch {
      return {
        movies: MOVIES,
        mode: "fallback" as const,
        message: "Live catalogue unavailable · showing clearly marked demo data.",
      };
    }
  };

  const findMovie = async () => {
    if (sharedRoom.room) {
      void sharedRoom.syncRoomConfig(settings, brief);
      void sharedRoom.syncPlaybackContext(playback);
    }
    trackProductEvent({
      name: "decision_requested",
      roomId: sharedRoom.room?.id,
      participantCount: activePeople.length,
      source: "button",
    });

    setIsFinding(true);
    setDismissedIds([]);
    setFeaturedId(null);
    try {
      const pool = await loadCandidatePool();
      setCatalogMovies(pool.movies);
      setCatalogMode(pool.mode);
      setCatalogMessage(pool.message);
      setHasSearched(true);
      scrollToResults();
    } finally {
      setIsFinding(false);
    }
  };

  const surpriseUs = async () => {
    setIsFinding(true);
    try {
      const next = await loadCandidatePool();
      const nextRanked = rankMovies({
        movies: next.movies,
        participants,
        settings,
        intent,
        dismissedIds: [],
      });
      const pool = nextRanked.slice(0, Math.min(5, nextRanked.length));
      if (!pool.length) {
        setCatalogMovies(next.movies);
        setCatalogMode(next.mode);
        setCatalogMessage(next.message);
        setHasSearched(true);
        scrollToResults();
        return;
      }

      const choice = pool[Math.floor(Math.random() * pool.length)];
      setCatalogMovies(next.movies);
      setCatalogMode(next.mode);
      setCatalogMessage(next.message);
      setDismissedIds([]);
      setFeaturedId(choice?.movie.id ?? null);
      setHasSearched(true);
      scrollToResults();
    } finally {
      setIsFinding(false);
    }
  };

  const resetDemo = () => {
    setParticipants(INITIAL_PARTICIPANTS);
    setSettings(INITIAL_SETTINGS);
    setPlayback(
      makeInitialPlaybackContext(
        typeof navigator === "undefined" ? undefined : navigator.language,
      ),
    );
    setCatalogMovies(MOVIES);
    setCatalogMode("demo");
    setCatalogMessage(null);
    setBrief("Something clever and fun, no horror, under 2 hours.");
    setIntent(null);
    setDismissedIds([]);
    setFeaturedId(null);
    setHasSearched(false);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#decision-builder">
        Skip to decision builder
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Reel Consensus home">
          <img
            className="brand-lockup"
            src="/brand/reel-consensus-lockup.svg"
            alt="Reel Consensus"
          />
        </a>

        <div className="header-actions">
          <div className="room-pill" aria-label={`${activePeople.length} people in the room`}>
            <div className="mini-avatars" aria-hidden="true">
              {activePeople.slice(0, 3).map((participant, index) => (
                <span key={participant.id}>
                  {participantInitials(participant.name, index)}
                </span>
              ))}
            </div>
            <strong>{activePeople.length} people</strong>
            <span>· {FAIRNESS_LABELS[settings.fairnessMode]}</span>
          </div>
          <a href="#how-it-works" className="header-link">
            Why it works
          </a>
        </div>
      </header>

      <div className="room-controls-wrap page-width">
        <RoomControls
          roomsEnabled={sharedRoom.roomsEnabled}
          status={sharedRoom.status}
          room={sharedRoom.room}
          selfParticipant={sharedRoom.selfParticipant}
          pendingInvite={sharedRoom.pendingInvite}
          inviteUrl={sharedRoom.inviteUrl}
          error={sharedRoom.error}
          onCreateRoom={sharedRoom.createRoom}
          onJoinRoom={sharedRoom.joinRoom}
          onSetReady={sharedRoom.setReady}
        />
      </div>

      <main id="top">
        <section className="hero page-width">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>Less debate. More movie nights.</span>
              <span>Fair by design</span>
            </div>
            <h1>
              One movie.
              <br />
              <em>Everyone on board.</em>
            </h1>
            <p>
              Stop trading recommendations. Tell Reel Consensus what each person wants,
              set the hard limits, and get the fairest movie for the whole room.
            </p>

            <div className="hero-actions">
              <a href="#decision-builder" className="primary-button">
                Start tonight's pick <span aria-hidden="true">→</span>
              </a>
              <button
                type="button"
                className="ghost-button"
                onClick={resetDemo}
                disabled={Boolean(sharedRoom.room)}
                title={sharedRoom.room ? "Reset is disabled while a shared room is active." : undefined}
              >
                Reset demo
              </button>
            </div>

            <div className="journey-strip" aria-label="Three-step decision flow">
              <div>
                <span>1</span>
                <strong>People</strong>
                <small>Who is watching?</small>
              </div>
              <i aria-hidden="true" />
              <div>
                <span>2</span>
                <strong>Tonight</strong>
                <small>Mood + hard limits</small>
              </div>
              <i aria-hidden="true" />
              <div>
                <span>3</span>
                <strong>Decide</strong>
                <small>Best compromise</small>
              </div>
            </div>
          </div>

          <aside className="consensus-preview" aria-label="Example group consensus">
            <div className="preview-topline">
              <div>
                <span className="preview-kicker">Tonight's room</span>
                <strong>Two tastes. One answer.</strong>
              </div>
              <span className="preview-mode">Balanced</span>
            </div>

            <div className="taste-pair">
              <div className="taste-card taste-card--one">
                <div className="taste-card__person">
                  <span className="taste-avatar">YO</span>
                  <div>
                    <strong>You</strong>
                    <small>Epic + fast</small>
                  </div>
                </div>
                <div className="taste-card__chips">
                  <span>Sci-fi</span>
                  <span>Action</span>
                  <span>Mind-bending</span>
                </div>
              </div>

              <div className="taste-link" aria-hidden="true">
                <span>+</span>
              </div>

              <div className="taste-card taste-card--two">
                <div className="taste-card__person">
                  <span className="taste-avatar">PA</span>
                  <div>
                    <strong>Partner</strong>
                    <small>Light + clever</small>
                  </div>
                </div>
                <div className="taste-card__chips">
                  <span>Mystery</span>
                  <span>Comedy</span>
                  <span className="taste-veto">No horror</span>
                </div>
              </div>
            </div>

            <div className="preview-divider">
              <span>fairness pass</span>
            </div>

            <div className="preview-outcome">
              <div className="preview-score" aria-label="86 percent group fit">
                <strong>86</strong>
                <span>%</span>
              </div>
              <div>
                <span className="preview-kicker">Group fit</span>
                <strong>Both people stay above the line.</strong>
                <p>High shared fit · no vetoes broken · low disagreement</p>
              </div>
            </div>
          </aside>
        </section>

        <section
          className="decision-section page-width"
          id="decision-builder"
          aria-labelledby="decision-heading"
        >
          <div className="section-intro">
            <div>
              <span className="section-number">01</span>
              <div className="section-kicker">The people</div>
              <h2 id="decision-heading">Give everyone a real vote.</h2>
            </div>
            <p>
              Start with the quick snapshot. Fine-tune only when someone has a strong
              preference or a hard no.
            </p>
          </div>

          <div className="participants-grid">
            {participants.map((participant, index) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                index={index}
                canRemove={!sharedRoom.room && participants.length > 1}
                readOnly={Boolean(sharedRoom.room && participant.id !== sharedRoom.selfUserId)}
                onChange={updateParticipant}
                onRemove={() =>
                  setParticipants((current) =>
                    current.filter((item) => item.id !== participant.id),
                  )
                }
              />
            ))}
          </div>

          <button
            className="add-person-button"
            type="button"
            disabled={Boolean(sharedRoom.room) || participants.length >= 5}
            onClick={() =>
              setParticipants((current) => [
                ...current,
                makeParticipant(current.length + 1),
              ])
            }
          >
            <span aria-hidden="true">+</span>
            {sharedRoom.room ? "Invite people from the room bar" : "Add another person"}
          </button>
        </section>

        <section className="tonight-section page-width" aria-labelledby="tonight-heading">
          <div className="section-intro">
            <div>
              <span className="section-number">02</span>
              <div className="section-kicker">The night</div>
              <h2 id="tonight-heading">Set the vibe, not a spreadsheet.</h2>
            </div>
            <p>
              A shared sentence covers the fuzzy part. A few explicit rules keep the
              engine honest.
            </p>
          </div>

          <div className="builder-grid">
            <IntentComposer
              value={brief}
              intent={intent}
              isLoading={isInterpreting}
              onChange={setBrief}
              onInterpret={interpretBrief}
            />
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </div>

          <AvailabilityPanel
            value={playback}
            onChange={updatePlayback}
            onCatalogueStatusChange={setCatalogAvailable}
          />
        </section>

        <section className="decision-dock page-width" aria-label="Current movie night summary">
          <div className="decision-dock__summary">
            <div className="decision-dock__people" aria-hidden="true">
              {activePeople.slice(0, 3).map((participant, index) => (
                <span key={participant.id}>
                  {participantInitials(participant.name, index)}
                </span>
              ))}
            </div>
            <div>
              <span>Tonight's decision</span>
              <strong>
                {activePeople.length} people · {FAIRNESS_LABELS[settings.fairnessMode]}
              </strong>
            </div>
          </div>

          <div className="decision-facts" aria-label="Current hard constraints">
            <span>{runtimeLabel}</span>
            <span>{ratingLabel}</span>
            <span>{playback.region}</span>
            <span>
              {playback.providerIds.length
                ? `${playback.providerIds.length} services`
                : "Any service"}
            </span>
            {settings.excludedGenres.length ? (
              <span>{settings.excludedGenres.length} group vetoes</span>
            ) : null}
          </div>

          <div className="decision-buttons">
            <button
              className="primary-button primary-button--large"
              type="button"
              disabled={isFinding}
              onClick={() => void findMovie()}
            >
              {isFinding ? "Checking availability…" : "Find our movie"}{" "}
              {!isFinding ? <span aria-hidden="true">→</span> : null}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={isFinding}
              onClick={() => void surpriseUs()}
            >
              Surprise us
            </button>
          </div>
        </section>

        {hasSearched ? (
          <section
            className="results-section page-width"
            ref={resultsRef}
            aria-labelledby="results-heading"
          >
            <div className="section-intro section-intro--results">
              <div>
                <span className="section-number">03</span>
                <div className="section-kicker">The decision</div>
                <h2 id="results-heading">Best compromises, explained.</h2>
              </div>
              <div className="results-intro-copy">
                <p>
                  {ranked.length} eligible movies remain after every hard constraint.
                  The first option is the strongest group compromise.
                </p>
                <span
                  className={
                    catalogMode === "live"
                      ? "catalog-result-note catalog-result-note--live"
                      : "catalog-result-note"
                  }
                >
                  {catalogMessage ??
                    (catalogMode === "loading"
                      ? "Checking live catalogue…"
                      : "Demo catalogue")}
                </span>
              </div>
            </div>

            {visibleResults.length ? (
              <div className="results-list">
                {visibleResults.map((result, index) => (
                  <ResultCard
                    key={result.movie.id}
                    result={result}
                    rank={ranked.findIndex((item) => item.movie.id === result.movie.id) + 1}
                    featured={index === 0}
                    onDismiss={(movieId) => {
                      trackProductEvent({
                        name: "candidate_dismissed",
                        roomId: sharedRoom.room?.id,
                        participantCount: activePeople.length,
                        movieId,
                        source: "button",
                      });
                      setDismissedIds((current) => [...current, movieId]);
                      if (featuredId === movieId) setFeaturedId(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="no-results" role="status">
                <span aria-hidden="true">∅</span>
                <h3>No fair match survives the hard constraints.</h3>
                <p>
                  {catalogMode === "live"
                    ? "Try another streaming service, allow rent/buy, or relax runtime or rating. Hard vetoes stay hard."
                    : "Relax runtime, rating, or one of the vetoes. Reel Consensus will not silently ignore a rule the group set."}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      maxRuntime: null,
                      minRating: null,
                      excludedGenres: [],
                    })
                  }
                >
                  Relax group constraints
                </button>
              </div>
            )}
          </section>
        ) : null}

        <section
          className="how-section page-width"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="section-intro">
            <div>
              <span className="section-number">04</span>
              <div className="section-kicker">Why trust the pick</div>
              <h2 id="how-heading">Transparent enough to argue with.</h2>
            </div>
            <p>
              A good group recommender should make its trade-offs visible instead of
              hiding them behind an AI answer.
            </p>
          </div>

          <div className="trust-grid">
            <article>
              <span className="trust-icon" aria-hidden="true">⊘</span>
              <h3>Hard limits stay hard.</h3>
              <p>
                Runtime, rating and vetoes filter movies before scoring. Nobody's hard
                no becomes a tiny negative weight.
              </p>
            </article>
            <article>
              <span className="trust-icon" aria-hidden="true">↔</span>
              <h3>Everyone gets a score.</h3>
              <p>
                Each person is scored independently, so a huge win for one person cannot
                completely hide a bad fit for someone else.
              </p>
            </article>
            <article>
              <span className="trust-icon" aria-hidden="true">✦</span>
              <h3>AI cannot overrule the room.</h3>
              <p>
                AI only interprets natural language. The final ranking remains
                deterministic, inspectable and available even when AI is offline.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div className="footer-brand">
          <img
            src="/brand/reel-consensus-mark.svg"
            alt=""
            aria-hidden="true"
          />
          <p>
            <strong>Reel Consensus</strong>
            <span>Less debate. More movie nights.</span>
          </p>
        </div>
        <p>Built for agreement, not endless recommendations.</p>
      </footer>
    </div>
  );
}
