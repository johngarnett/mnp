/*
  The five-player street-league format (first used by Northend Street League
  Pinball): 5-player teams, four rounds of 2 doubles / 5 singles / 5 singles /
  2 doubles, singles rounds shortened to the smaller lineup when a team has 4,
  a 5-point participation bonus for a full lineup, no handicap, and a single
  singles game as a tie-breaker when the match is tied after round 4.

  See docs/formats.md for what each field means.
*/
module.exports = {
  name: 'five-player',
  lineup: { min: 4, max: 5, truncateGamesToLineup: true },
  rounds: [
    { games: 2, playersPerGame: 4, type: 'doubles', firstPick: 'away' },
    { games: 5, playersPerGame: 2, type: 'singles', firstPick: 'home' },
    { games: 5, playersPerGame: 2, type: 'singles', firstPick: 'away' },
    { games: 2, playersPerGame: 4, type: 'doubles', firstPick: 'home' }
  ],
  tieBreaker: { games: 1, playersPerGame: 2, type: 'singles', firstPick: 'away' },
  participationBonus: {
    roundsForCredit: 3,
    byPlayersWithCredit: { 5: 5 },
    // A team that fielded an illegal substitute (an admin sets
    // "illegalSubstitution": true on the team in the match file) forfeits its bonus.
    forfeitOnIllegalSubstitution: true
  },
  handicap: { enabled: false },
  // After the win/loss/tie record, standings are ordered by (and show) each
  // team's total points over the season.
  standings: { rankBy: 'points' },
  expectedGamePoints: 0
};
