import type { CSSProperties } from "react";
import type { RankedMovie } from "../domain/types";

type ResultCardProps = {
  result: RankedMovie;
  rank: number;
  featured?: boolean;
  onDismiss: (movieId: string) => void;
};

export function ResultCard({ result, rank, featured = false, onDismiss }: ResultCardProps) {
  const { movie } = result;

  return (
    <article className={featured ? "result-card result-card--featured" : "result-card"}>
      <div className="movie-mark" style={{ "--movie-accent": movie.accent } as CSSProperties}>
        <span className="movie-mark__rank">#{rank}</span>
        <span className="movie-mark__glyph" aria-hidden="true">{movie.glyph}</span>
        <div>
          <span>{movie.year}</span>
          <strong>{movie.title}</strong>
        </div>
      </div>

      <div className="result-card__content">
        <div className="result-card__topline">
          <div>
            <span className="result-label">Group fit</span>
            <div className="fit-score">{result.groupScore}<small>%</small></div>
          </div>
          <div className="movie-meta">
            <span>{movie.runtime} min</span>
            <span>{movie.rating.toFixed(1)} / 10</span>
          </div>
        </div>

        <p className="movie-summary">{movie.summary}</p>
        <div className="genre-line">
          {movie.genres.map((genre) => <span key={genre}>{genre}</span>)}
        </div>

        <div className="fit-breakdown" aria-label="Participant fit scores">
          {result.participantScores.map((score) => (
            <div className="person-fit" key={score.participantId}>
              <div><span>{score.name}</span><strong>{score.score}%</strong></div>
              <div className="fit-track"><span style={{ width: `${score.score}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="explanation-grid">
          <div>
            <h3>Why it works</h3>
            <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
          <div>
            <h3>Trade-off</h3>
            <ul className="tradeoffs">{result.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul>
          </div>
        </div>

        <button type="button" className="text-button" onClick={() => onDismiss(movie.id)}>Not tonight → show another</button>
      </div>
    </article>
  );
}
