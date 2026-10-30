/*
  The match format in use: how many games and players each round has, who picks
  first, lineup limits, the participation bonus, the handicap, and whether a
  tied match plays a tie-breaker. Selected by MATCH_FORMAT (ten-player by
  default); one data file per format lives next to this one.

  Game types: 'doubles' (4 players, 4 scores) or 'singles' (2 players, 2
  scores). The team that picks first fills slots 1 and 3 of each game; the
  responding team fills slots 2 and 4. Rounds are numbered from 1; the
  tie-breaker, when a format has one, is round regularRounds + 1.
*/
const load = require('./load');

const DEFAULT_FORMAT = 'ten-player';

module.exports = load(process.env.MATCH_FORMAT || DEFAULT_FORMAT);
