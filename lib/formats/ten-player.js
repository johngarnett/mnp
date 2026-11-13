/*
  Monday Night Pinball's match format: 10-player teams, four rounds of
  4 doubles / 7 singles / 7 singles / 4 doubles, a participation bonus for 9 or
  10 players each playing 3 rounds, an IPR-based handicap bonus, and no
  tie-breaker (a tied match stays a tie).

  See docs/formats.md for what each field means.
*/
module.exports = {
  name: 'ten-player',
  lineup: { min: 8, max: 10, truncateGamesToLineup: false },
  rounds: [
    { games: 4, playersPerGame: 4, type: 'doubles', firstPick: 'away' },
    { games: 7, playersPerGame: 2, type: 'singles', firstPick: 'home' },
    { games: 7, playersPerGame: 2, type: 'singles', firstPick: 'away' },
    { games: 4, playersPerGame: 4, type: 'doubles', firstPick: 'home' }
  ],
  tieBreaker: null,
  participationBonus: {
    roundsForCredit: 3,
    byPlayersWithCredit: { 10: 9, 9: 4 },
    forfeitOnIllegalSubstitution: false
  },
  handicap: { enabled: true, targetIpr: 50, divisor: 2, cap: 15 },
  // After the win/loss/tie record, standings are ordered by (and show) each
  // team's average share of the points in its matches (POPS).
  standings: { rankBy: 'pops' },
  // Points a team is expected to score from games alone, for the "points to tie" line.
  expectedGamePoints: 41
};
