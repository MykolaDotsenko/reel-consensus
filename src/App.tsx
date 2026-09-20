import { useMemo, useRef, useState } from "react";
import { IntentComposer } from "./components/IntentComposer";
import { ParticipantCard } from "./components/ParticipantCard";
import { ResultCard } from "./components/ResultCard";
import { SettingsPanel } from "./components/SettingsPanel";
import { MOVIES } from "./data/movies";
import { rankMovies } from "./domain/decisionEngine";
import type { DecisionSettings, Participant, SharedIntent } from "./domain/types";
import { interpretIntent } from "./lib/interpretIntent";

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

const makeParticipant = (number: number): Participant => ({
  id: `guest-${number}-${Date.now()}`,
  name: `Guest ${number}`,
  likedGenres: [],
  avoidedGenres: [],
  moods: [],
});

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [settings, setSettings] = useState<DecisionSettings>(INITIAL_SETTINGS);
  const [brief, setBrief] = useState("Something clever and fun, no horror, under 2 hours.");
  const [intent, setIntent] = useState<SharedIntent | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const ranked = useMemo(
    () => rankMovies({ movies: MOVIES, participants, settings, intent, dismissedIds }),
    [participants, settings, intent, dismissedIds],
  );

  const visibleResults = useMemo(() => {
    if (!featuredId) return ranked.slice(0, 3);
    const featured = ranked.find((result) => result.movie.id === featuredId);
    if (!featured) return ranked.slice(0, 3);
    return [featured, ...ranked.filter((result) => result.movie.id !== featuredId)].slice(0, 3);
  }, [featuredId, ranked]);

  const updateParticipant = (participant: Participant) => {
    setParticipants((current) => current.map((item) => (item.id === participant.id ? participant : item)));
  };

  const interpretBrief = async () => {
    setIsInterpreting(true);
    try {
      const { intent: interpreted } = await interpretIntent(brief);
      setIntent(interpreted);
    } finally {
      setIsInterpreting(false);
    }
  };

  const findMovie = () => {
    setDismissedIds([]);
    setFeaturedId(null);
    setHasSearched(true);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const surpriseUs = () => {
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    if (!pool.length) return;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    setFeaturedId(choice?.movie.id ?? null);
    setHasSearched(true);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const resetDemo = () => {
    setParticipants(INITIAL_PARTICIPANTS);
    setSettings(INITIAL_SETTINGS);
    setBrief("Something clever and fun, no horror, under 2 hours.");
    setIntent(null);
    setDismissedIds([]);
    setFeaturedId(null);
    setHasSearched(false);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#decision-builder">Skip to decision builder</a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Reel Consensus home">
          <span className="brand-mark" aria-hidden="true">RC</span>
          <span>
            <strong>Reel Consensus</strong>
            <small>Group movie decisions</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="engine-pill"><span /> Deterministic core</span>
          <a href="#how-it-works" className="header-link">How it works</a>
        </div>
      </header>

      <main id="top">
        <section className="hero page-width">
          <div className="hero-copy">
            <div className="hero-kicker"><span>Decision engine</span><span>AI-assisted</span><span>Explainable</span></div>
            <h1>Stop scrolling.<br /><em>Agree on something</em> worth watching.</h1>
            <p>
              Reel Consensus finds the movie that works for the whole group — not the movie one person loves and everyone else tolerates.
            </p>
            <div className="hero-actions">
              <a href="#decision-builder" className="primary-button">Build tonight's decision</a>
              <button type="button" className="ghost-button" onClick={resetDemo}>Reset demo night</button>
            </div>
          </div>

          <aside className="hero-proof" aria-label="Example recommendation logic">
            <div className="proof-topline"><span>Tonight's trade-off</span><strong>Balanced</strong></div>
            <div className="proof-versus">
              <div><span>You</span><strong>10</strong></div>
              <span className="proof-arrow">→</span>
              <div><span>Partner</span><strong>2</strong></div>
              <span className="proof-bad">bad compromise</span>
            </div>
            <div className="proof-divider" />
            <div className="proof-versus proof-versus--good">
              <div><span>You</span><strong>8</strong></div>
              <span className="proof-arrow">↔</span>
              <div><span>Partner</span><strong>8</strong></div>
              <span className="proof-good">group win</span>
            </div>
            <p>We optimize for agreement, not just the average.</p>
          </aside>
        </section>

        <section className="decision-section page-width" id="decision-builder" aria-labelledby="decision-heading">
          <div className="section-intro">
            <div>
              <span className="section-number">01</span>
              <div className="section-kicker">Tonight's group</div>
              <h2 id="decision-heading">Who gets a vote?</h2>
            </div>
            <p>Each person's preferences stay visible. Hard dislikes are treated as vetoes, not tiny negative weights.</p>
          </div>

          <div className="participants-grid">
            {participants.map((participant, index) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                index={index}
                canRemove={participants.length > 1}
                onChange={updateParticipant}
                onRemove={() => setParticipants((current) => current.filter((item) => item.id !== participant.id))}
              />
            ))}
          </div>

          <button
            className="add-person-button"
            type="button"
            disabled={participants.length >= 5}
            onClick={() => setParticipants((current) => [...current, makeParticipant(current.length + 1)])}
          >
            <span aria-hidden="true">+</span> Add person
          </button>
        </section>

        <section className="builder-grid page-width">
          <IntentComposer
            value={brief}
            intent={intent}
            isLoading={isInterpreting}
            onChange={setBrief}
            onInterpret={interpretBrief}
          />
          <SettingsPanel settings={settings} onChange={setSettings} />
        </section>

        <section className="decision-cta page-width">
          <div>
            <span className="section-number">02</span>
            <div className="section-kicker">Run the decision</div>
            <h2>Ready to stop negotiating?</h2>
            <p>{MOVIES.length} curated demo titles · hard constraints first · fairness second · explanations always.</p>
          </div>
          <div className="decision-buttons">
            <button className="primary-button primary-button--large" type="button" onClick={findMovie}>Find our movie <span>→</span></button>
            <button className="ghost-button" type="button" onClick={surpriseUs}>Surprise us</button>
          </div>
        </section>

        {hasSearched ? (
          <section className="results-section page-width" ref={resultsRef} aria-labelledby="results-heading">
            <div className="section-intro section-intro--results">
              <div>
                <span className="section-number">03</span>
                <div className="section-kicker">Consensus found</div>
                <h2 id="results-heading">Best compromises, explained.</h2>
              </div>
              <p>{ranked.length} eligible movies remain after hard constraints.</p>
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
                <p>Relax runtime, rating, or one of the vetoes. The engine will not silently ignore them.</p>
                <button type="button" className="secondary-button" onClick={() => setSettings({ ...settings, maxRuntime: null, minRating: null, excludedGenres: [] })}>
                  Relax group constraints
                </button>
              </div>
            )}
          </section>
        ) : null}

        <section className="how-section page-width" id="how-it-works" aria-labelledby="how-heading">
          <div className="section-intro">
            <div>
              <span className="section-number">04</span>
              <div className="section-kicker">Under the hood</div>
              <h2 id="how-heading">AI understands. The engine decides.</h2>
            </div>
            <p>AI is an interpreter, never the hidden judge. If it is unavailable, the product still works.</p>
          </div>
          <div className="how-grid">
            <article><span>1</span><h3>Interpret</h3><p>Natural language becomes structured moods, preferences, vetoes, runtime, and rating constraints.</p></article>
            <article><span>2</span><h3>Filter</h3><p>Hard constraints remove ineligible titles before any recommendation score is calculated.</p></article>
            <article><span>3</span><h3>Score fairly</h3><p>Every participant gets an independent fit score. Fairness mode controls how compromise is optimized.</p></article>
            <article><span>4</span><h3>Explain</h3><p>The winner shows per-person fit, reasons, and trade-offs — so the group can trust the decision.</p></article>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <p><strong>Reel Consensus</strong> · Less scrolling. Better movie nights.</p>
        <p>Built around fair decisions, not black-box picks.</p>
      </footer>
    </div>
  );
}
