import type {
  DecisionSettings,
  Genre,
  Movie,
  Participant,
  ParticipantScore,
  RankedMovie,
  SharedIntent,
} from "./types";

const unique = <T,>(values: T[]) => [...new Set(values)];
const round = (value: number) => Math.round(value);
const intersect = <T,>(left: T[], right: T[]) => left.filter((item) => right.includes(item));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const standardDeviation = (values: number[], mean: number) => {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const effectiveMaxRuntime = (settings: DecisionSettings, intent: SharedIntent | null) => {
  const values = [settings.maxRuntime, intent?.maxRuntime ?? null].filter(
    (value): value is number => value !== null,
  );
  return values.length ? Math.min(...values) : null;
};

const effectiveMinRating = (settings: DecisionSettings, intent: SharedIntent | null) => {
  const values = [settings.minRating, intent?.minRating ?? null].filter(
    (value): value is number => value !== null,
  );
  return values.length ? Math.max(...values) : null;
};

const hardExcludedGenres = (settings: DecisionSettings, intent: SharedIntent | null): Genre[] =>
  unique([...settings.excludedGenres, ...(intent?.avoidedGenres ?? [])]);

const passesHardConstraints = (
  movie: Movie,
  participants: Participant[],
  settings: DecisionSettings,
  intent: SharedIntent | null,
) => {
  const maxRuntime = effectiveMaxRuntime(settings, intent);
  const minRating = effectiveMinRating(settings, intent);
  const excludedGenres = hardExcludedGenres(settings, intent);

  if (maxRuntime !== null && movie.runtime > maxRuntime) return false;
  if (minRating !== null && movie.rating < minRating) return false;
  if (movie.genres.some((genre) => excludedGenres.includes(genre))) return false;
  if (participants.some((participant) => movie.genres.some((genre) => participant.avoidedGenres.includes(genre)))) {
    return false;
  }

  return true;
};

const scoreParticipant = (movie: Movie, participant: Participant): ParticipantScore => {
  const matchedGenres = intersect(movie.genres, participant.likedGenres);
  const matchedMoods = intersect(movie.moods, participant.moods);

  const genrePoints = Math.min(36, matchedGenres.length * 18);
  const moodPoints = Math.min(24, matchedMoods.length * 12);
  const qualityPoints = movie.rating * 1.5;
  const preferenceCount = participant.likedGenres.length + participant.moods.length;
  const neutralFloor = preferenceCount === 0 ? 48 : 26;

  return {
    participantId: participant.id,
    name: participant.name.trim() || "Guest",
    score: Math.min(100, round(neutralFloor + genrePoints + moodPoints + qualityPoints)),
    matchedGenres,
    matchedMoods,
  };
};

const sharedIntentBonus = (movie: Movie, intent: SharedIntent | null) => {
  if (!intent) return 0;
  const genreMatches = intersect(movie.genres, intent.likedGenres).length;
  const moodMatches = intersect(movie.moods, intent.moods).length;
  return Math.min(10, genreMatches * 4 + moodMatches * 3);
};

const fairnessScore = (scores: number[], mode: DecisionSettings["fairnessMode"]) => {
  const mean = average(scores);
  const minimum = Math.min(...scores);
  const disagreement = standardDeviation(scores, mean);
  const agreement = Math.max(0, 100 - disagreement * 3);

  switch (mode) {
    case "democratic":
      return 0.85 * mean + 0.15 * agreement;
    case "no-one-hates-it":
      return 0.4 * mean + 0.5 * minimum + 0.1 * agreement;
    case "balanced":
      return 0.55 * mean + 0.25 * minimum + 0.2 * agreement;
  }
};

const formatList = (values: string[]) => {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
};

const buildReasons = (
  movie: Movie,
  scores: ParticipantScore[],
  settings: DecisionSettings,
  intent: SharedIntent | null,
  disagreement: number,
) => {
  const reasons: string[] = [];
  const groupGenres = unique(scores.flatMap((score) => score.matchedGenres));
  const groupMoods = unique(scores.flatMap((score) => score.matchedMoods));
  const intentGenres = intent ? intersect(movie.genres, intent.likedGenres) : [];
  const intentMoods = intent ? intersect(movie.moods, intent.moods) : [];
  const maxRuntime = effectiveMaxRuntime(settings, intent);

  if (groupGenres.length) reasons.push(`Matches ${formatList(groupGenres.slice(0, 3))} preferences across the group.`);
  if (groupMoods.length) reasons.push(`Fits the ${formatList(groupMoods.slice(0, 2))} mood you asked for.`);
  if (intentGenres.length || intentMoods.length) reasons.push("Directly reflects the shared brief you described in plain language.");
  if (disagreement < 8) reasons.push("Very low disagreement: nobody is being asked to take a big hit.");
  if (maxRuntime !== null) reasons.push(`Fits inside the ${maxRuntime}-minute hard limit.`);
  if (movie.rating >= 8) reasons.push("Strong quality signal without overriding individual preferences.");

  return reasons.slice(0, 4);
};

const buildTradeoffs = (
  movie: Movie,
  scores: ParticipantScore[],
  settings: DecisionSettings,
  intent: SharedIntent | null,
) => {
  const tradeoffs: string[] = [];
  const weakest = scores.reduce((current, score) => (score.score < current.score ? score : current), scores[0]!);
  const maxRuntime = effectiveMaxRuntime(settings, intent);

  if (weakest.score < 62) tradeoffs.push(`${weakest.name}'s preferences are only partially matched.`);
  if (maxRuntime !== null && movie.runtime >= maxRuntime * 0.9) tradeoffs.push("It uses most of the available runtime window.");
  if (movie.moods.includes("tense") && !(intent?.moods.includes("tense") ?? false)) tradeoffs.push("It leans tenser than the shared brief explicitly requested.");
  if (!tradeoffs.length) tradeoffs.push("No material trade-off stands out for this group setup.");

  return tradeoffs.slice(0, 2);
};

export const rankMovies = ({
  movies,
  participants,
  settings,
  intent,
  dismissedIds = [],
}: {
  movies: Movie[];
  participants: Participant[];
  settings: DecisionSettings;
  intent: SharedIntent | null;
  dismissedIds?: string[];
}): RankedMovie[] => {
  const activeParticipants = participants.filter((participant) => participant.name.trim());
  const safeParticipants = activeParticipants.length ? activeParticipants : participants.slice(0, 1);

  return movies
    .filter((movie) => !dismissedIds.includes(movie.id))
    .filter((movie) => passesHardConstraints(movie, safeParticipants, settings, intent))
    .map((movie) => {
      const participantScores = safeParticipants.map((participant) => scoreParticipant(movie, participant));
      const rawScores = participantScores.map((score) => score.score);
      const meanScore = average(rawScores);
      const minimumScore = Math.min(...rawScores);
      const disagreement = standardDeviation(rawScores, meanScore);
      const score = fairnessScore(rawScores, settings.fairnessMode) + sharedIntentBonus(movie, intent);

      return {
        movie,
        groupScore: Math.min(99, round(score)),
        meanScore: round(meanScore),
        minimumScore: round(minimumScore),
        disagreement: round(disagreement),
        participantScores,
        reasons: buildReasons(movie, participantScores, settings, intent, disagreement),
        tradeoffs: buildTradeoffs(movie, participantScores, settings, intent),
      };
    })
    .sort((a, b) => b.groupScore - a.groupScore || b.movie.rating - a.movie.rating);
};
