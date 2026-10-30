/*
  Points for one game, by game type. Doubles: a point for each head-to-head
  pairing (slots 1 and 3 against 2 and 4), plus half a point to each player on
  the side with the higher combined score. Singles: 3-0 when a player at least
  doubles the other's score, otherwise 2-1.

  scoreGame(game, spec) writes points_1..4, score_13/24, points_13/24 and
  away_points/home_points on the game; spec.firstPick says which side filled
  the odd slots.
*/
const DOUBLES_PAIR_POINT = 1;
const DOUBLES_TOTAL_POINT = 0.5;
const SINGLES_WIN = 2;
const SINGLES_LOSS = 1;
const SINGLES_DOUBLED = 3;
const DOUBLE_RATIO = 2;
// Points available to one player in a game of each type: 2.5 in doubles (two
// pairings and the shared half point), 3 in singles.
const POINTS_AVAILABLE = { doubles: 2.5, singles: 3 };

function calcDoubles(scores) {
  const points = [0, 0, 0, 0];
  const total13 = scores[0] + scores[2];
  const total24 = scores[1] + scores[3];

  if (scores[0] > scores[1]) points[0] += DOUBLES_PAIR_POINT;
  else points[1] += DOUBLES_PAIR_POINT;
  if (scores[0] > scores[3]) points[0] += DOUBLES_PAIR_POINT;
  else points[3] += DOUBLES_PAIR_POINT;
  if (scores[2] > scores[1]) points[2] += DOUBLES_PAIR_POINT;
  else points[1] += DOUBLES_PAIR_POINT;
  if (scores[2] > scores[3]) points[2] += DOUBLES_PAIR_POINT;
  else points[3] += DOUBLES_PAIR_POINT;

  if (total13 > total24) {
    points[0] += DOUBLES_TOTAL_POINT;
    points[2] += DOUBLES_TOTAL_POINT;
  } else {
    points[1] += DOUBLES_TOTAL_POINT;
    points[3] += DOUBLES_TOTAL_POINT;
  }
  return points;
}

function calcSingles(scores) {
  const ratio = scores[0] / scores[1];

  // Exactly double counts as doubled (there was a 23-46 game once).
  if (ratio >= DOUBLE_RATIO) return [SINGLES_DOUBLED, 0];
  if (ratio > 1) return [SINGLES_WIN, SINGLES_LOSS];
  if (ratio > 1 / DOUBLE_RATIO) return [SINGLES_LOSS, SINGLES_WIN];
  return [0, SINGLES_DOUBLED];
}

function scoreGame(game, spec) {
  if (spec.type === 'doubles') {
    const points = calcDoubles([game.score_1, game.score_2, game.score_3, game.score_4]);

    game.points_1 = points[0];
    game.points_2 = points[1];
    game.points_3 = points[2];
    game.points_4 = points[3];
    game.score_13 = game.score_1 + game.score_3;
    game.score_24 = game.score_2 + game.score_4;
    game.points_13 = points[0] + points[2];
    game.points_24 = points[1] + points[3];
  } else {
    const points = calcSingles([game.score_1, game.score_2]);

    game.points_1 = points[0];
    game.points_2 = points[1];
    game.points_13 = points[0];
    game.points_24 = points[1];
    game.score_13 = game.score_1;
    game.score_24 = game.score_2;
  }
  const firstPickPoints = game.points_13;
  const respondingPoints = game.points_24;

  game.away_points = spec.firstPick === 'away' ? firstPickPoints : respondingPoints;
  game.home_points = spec.firstPick === 'home' ? firstPickPoints : respondingPoints;
  return game;
}

// Away and home points for scores given in slot order, without a game object.
function sidePoints(scores, spec) {
  const game = {};

  scores.forEach((score, i) => {
    game[`score_${i + 1}`] = score;
  });
  scoreGame(game, spec);
  return { away_points: game.away_points, home_points: game.home_points };
}

function pointsAvailable(spec) {
  return POINTS_AVAILABLE[spec.type];
}

module.exports = { calcDoubles, calcSingles, scoreGame, sidePoints, pointsAvailable };
