# Match formats

The match format is configuration: `MATCH_FORMAT` names a file in
`lib/formats/`, and everything about the shape of a match comes from it. The
server ships two:

| Setting | `ten-player` (Monday Night Pinball) | `five-player` (street league) |
|---|---|---|
| Lineup | 8 to 10 players | 4 or 5 players |
| Round 1 | 4 doubles games, away picks first | 2 doubles games, away picks first |
| Round 2 | 7 singles games, home picks first | 5 singles games, home picks first |
| Round 3 | 7 singles games, away picks first | 5 singles games, away picks first |
| Round 4 | 4 doubles games, home picks first | 2 doubles games, home picks first |
| Short lineup | lineup must be 8+ | singles rounds shrink to what 4 players can fill |
| Participation bonus | 9 points for 10 players, 4 for 9, each playing 3+ rounds | 5 points for 5 players each playing 3+ rounds |
| Illegal substitution | no effect on the bonus | forfeits the bonus |
| Handicap | (50 - team IPR) / 2, 0 to 15 | none |
| Tie after round 4 | the match is a tie | one singles game, away picks first |
| Player-rounds per team | 30 | 18 |

## The format file

```js
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
      forfeitOnIllegalSubstitution: true
   },
   handicap: { enabled: false },
   standings: { rankBy: 'points' },
   expectedGamePoints: 0
}
```

- `rounds`: the regular rounds, in order. `type` is `doubles` (4 players and
  4 scores per game) or `singles` (2 and 2). `firstPick` is the side that
  picks machines and players first; it fills slots 1 and 3 of every game, and
  the responding side fills slots 2 and 4. Scoring uses only `type` and
  `firstPick`, never the round number.
- `lineup`: how many players a team needs before it can start, and whether a
  round is shortened when a lineup can't fill all its games.
- `tieBreaker`: `null`, or one more round played only when the regular-round
  totals (bonus and `point_adjust` included) are equal. Its points are shown
  as a "TB" column and decide the result (`match.getResult()` and the
  standings) without changing the totals, and its games don't count as games
  played.
- `participationBonus`: a player is credited after `roundsForCredit` rounds;
  the bonus is `byPlayersWithCredit[number of credited players]`, or 0. With
  `forfeitOnIllegalSubstitution`, a team whose match file has
  `"illegalSubstitution": true` (an admin sets it on the `home` or `away`
  team) gets no bonus.
- `handicap`: when enabled, `(targetIpr - team IPR) / divisor`, truncated and
  held between 0 and `cap`. `lib/handicap.js` has the full rule, including how
  a lineup shorter than `lineup.max` is filled in and how a team that didn't
  play every player gets the handicap of the rounds actually played.
- `standings`: `rankBy` is the stat that orders teams with the same
  win/loss/tie record and fills the last standings column: `points` (total
  points over the season) or `pops` (average share of the points in the
  team's matches, shown to three decimals).
- `expectedGamePoints`: what a team typically scores from games alone, for the
  "Match Target to Tie" lines on the match pages. Those lines show only when
  the handicap is enabled, since they exist to show what the handicaps mean.

Bonus and handicap are awarded once every regular-round game has been played.

`lib/formats/load.js` validates a format at startup and adds `regularRounds`,
`tieBreakerRound`, `roundSpec(n)`, `isTieBreaker(n)` and
`playerRoundsPerMatch`.

## Adding a format

1. Copy `lib/formats/five-player.js` to `lib/formats/<name>.js` and change
   the values. Names use letters, digits and dashes.
2. Set `MATCH_FORMAT=<name>` and start the server; a bad file is reported at
   startup.
3. Add a test like `tests/five-player.test.js`; `tests/helpers/simulate-match.js`
   plays a whole match through the model.

## Match-file flags an admin can set

- `"point_adjust": { "home_points": 0, "away_points": -2 }` on the match, for
  forfeits and suspended matches. A negative adjustment comes out of the team's
  bonus when the bonus covers it, otherwise out of its points.
- `"illegalSubstitution": true` on a team, in formats that forfeit the bonus
  for it.

Reload the matches (`/matches/reload` as an admin, or restart) after editing a
match file.

## Golden tests

`tests/format-golden.test.js` replays MNP matches through the model and
compares the results with snapshots taken before the format became
configurable, so the ten-player rules are known to be unchanged. After an
intentional rule change, re-capture them with `GOLDEN_UPDATE=1 npm test` and
review the diff.
