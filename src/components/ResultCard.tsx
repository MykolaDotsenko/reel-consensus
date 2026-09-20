import type { CSSProperties } from "react";
import type { RankedMovie } from "../domain/types";

type ResultCardProps = {
  result: RankedMovie;
  rank: number;
  featured?: boolean;
  onDismiss: (movieId: string) => void;
};

const fitLabel = (score: number) => {
  if (score >= 88) return "Strong consensus";
  if (score >= 78) return "Good compromise";
  return "Worth a vote";
};

export function ResultCard({
  result,
  rank,
  featured = false,
  onDismiss,
}: ResultCardProps) {
  const { movie } = result;
  const availability = movie.availability ?? [];
  const providers = [
    ...new Map(
      availability.map((item) => [item.providerId, item.providerName]),
    ).values(),
  ];
  const watchUrl = availability.find((item) => item.sourceUrl)?.sourceUrl ?? null;

  const scoreStyle = {
    "--fit-angle": `${result.groupScore * 3.6}deg`,
  } as CSSProperties;

  return (
    <article className={featured ? "result-card result-card--featured" : "result-card"}>
      <div
        className={movie.posterUrl ? "movie-mark movie-mark--poster" : "movie-mark"}
        style={{ "--movie-accent": movie.accent } as CSSProperties}
      >
        {movie.posterUrl ? (
          <img
            className="movie-mark__poster"
            src={movie.posterUrl}
            alt=""
            loading={featured ? "eager" : "lazy"}
          />
        ) : null}
        <div className="movie-mark__topline">
          <span className="movie-mark__rank">
            {featured ? "Best compromise" : `Option #${rank}`}
          </span>
          <span className="movie-mark__year">{movie.year}</span>
        </div>

        {!movie.posterUrl ? (
          <span className="movie-mark__glyph" aria-hidden="true">
            {movie.glyph}
          </span>
        ) : (
          <span className="movie-mark__poster-spacer" aria-hidden="true" />
        )}

        <div className="movie-mark__title">
          <strong>{movie.title}</strong>
          <div>
            {movie.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="result-card__content">
        <div className="result-card__topline">
          <div className="consensus-score">
            <div className="consensus-ring" style={scoreStyle} aria-label={`${result.groupScore}% group fit`}>
              <div>
                <strong>{result.groupScore}</strong>
                <span>%</span>
              </div>
            </div>
            <div>
              <span className="result-label">Group fit</span>
              <strong className="fit-verdict">{fitLabel(result.groupScore)}</strong>
              <small>
                Min {result.minimumScore}% · disagreement {result.disagreement}
              </small>
            </div>
          </div>

          <div className="movie-meta">
            <span>{movie.runtime} min</span>
            <span>★ {movie.rating.toFixed(1)}</span>
          </div>
        </div>

        {providers.length ? (
          <div className="watch-row">
            <span className="watch-row__label">Watch on</span>
            <div className="watch-row__providers">
              {providers.slice(0, 4).map((provider) => (
                <span key={provider}>{provider}</span>
              ))}
            </div>
            {watchUrl ? (
              <a href={watchUrl} target="_blank" rel="noreferrer">
                Availability ↗
              </a>
            ) : null}
          </div>
        ) : null}

        <p className="movie-summary">{movie.summary}</p>

        <div className="fit-breakdown" aria-label="Participant fit scores">
          {result.participantScores.map((score) => (
            <div className="person-fit" key={score.participantId}>
              <div>
                <span>{score.name}</span>
                <strong>{score.score}%</strong>
              </div>
              <div className="fit-track">
                <span style={{ width: `${score.score}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="explanation-grid">
          <div className="explanation-panel explanation-panel--positive">
            <h3>Why this works</h3>
            <ul>
              {result.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="explanation-panel">
            <h3>What you trade</h3>
            <ul className="tradeoffs">
              {result.tradeoffs.map((tradeoff) => (
                <li key={tradeoff}>{tradeoff}</li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => onDismiss(movie.id)}
        >
          Not tonight <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}
