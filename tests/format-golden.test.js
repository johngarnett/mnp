/*
   Golden tests for the ten-player (MNP) match format. The snapshots in
   tests/fixtures/golden/ were captured from the code before the match format was
   made configurable (lib/formats), so they prove that scoring, bonus, handicap,
   games-played counts, completion and standings are unchanged for MNP.

   To re-capture after an intentional rule change: GOLDEN_UPDATE=1 npm test
*/
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')
const { rosterFor, defaultScoreFor } = require('./helpers/simulate-match')

const GOLDEN_DIR = path.join(__dirname, 'fixtures', 'golden')
const UPDATE = !!process.env.GOLDEN_UPDATE

// MNP: 4 doubles, 7 singles, 7 singles, 4 doubles.
const TEN_PLAYER_SHAPE = [
   { games: 4, playersPerGame: 4 },
   { games: 7, playersPerGame: 2 },
   { games: 7, playersPerGame: 2 },
   { games: 4, playersPerGame: 4 }
]
const FULL = 10
const NINE = 9
const EIGHT = 8
const ROUNDS_PLAYED_MID_MATCH = 2
const MIXED_IPRS = [6, 5, 5, 4, 4, 3, 3, 2, 2, 1]
const FLAT_IPRS = Array(FULL).fill(4)
const STRONG_IPRS = Array(FULL).fill(6)

// Same score pattern in rounds 1 and 4 and in rounds 2 and 3, so the mirrored
// pick order makes the match a tie (bonuses are equal when lineups match).
function mirroredScoreFor(round, game, slot) {
   return defaultScoreFor(1, game, slot)
}

const SCENARIOS = {
   'full-ten': { awayKey: 'FTA', homeKey: 'FTH', awaySize: FULL, homeSize: FULL, awayIprs: MIXED_IPRS, homeIprs: FLAT_IPRS },
   'nine-vs-eight': { awayKey: 'NEA', homeKey: 'NEH', awaySize: NINE, homeSize: EIGHT, awayIprs: MIXED_IPRS, homeIprs: FLAT_IPRS },
   'strong-no-handicap': { awayKey: 'SNA', homeKey: 'SNH', awaySize: FULL, homeSize: FULL, awayIprs: STRONG_IPRS, homeIprs: STRONG_IPRS },
   'point-adjust': { awayKey: 'PAA', homeKey: 'PAH', awaySize: FULL, homeSize: FULL, awayIprs: FLAT_IPRS, homeIprs: FLAT_IPRS, pointAdjust: { home_points: -3, away_points: 2 } },
   'mid-match': { awayKey: 'MMA', homeKey: 'MMH', awaySize: FULL, homeSize: FULL, awayIprs: FLAT_IPRS, homeIprs: FLAT_IPRS, rounds: ROUNDS_PLAYED_MID_MATCH },
   'tied-match': { awayKey: 'TMA', homeKey: 'TMH', awaySize: FULL, homeSize: FULL, awayIprs: FLAT_IPRS, homeIprs: FLAT_IPRS, scoreFor: mirroredScoreFor }
}
const GROUP_KEY = 'golden'

function ratingsFor(scenarios) {
   return Object.values(scenarios).flatMap(s => [
      ...rosterFor(s.awayKey, s.awaySize, s.awayIprs),
      ...rosterFor(s.homeKey, s.homeSize, s.homeIprs)
   ])
}

function matchKey(name) {
   return `mnp-1-1-${name}`
}

// season.json entries so get-standings sees every golden match in week 1.
function seasonFor(scenarios) {
   const teams = {}
   const keys = Object.keys(scenarios)

   keys.forEach(name => {
      const s = scenarios[name]
      teams[s.awayKey] = { key: s.awayKey, name: `${s.awayKey} Team`, division: 1 }
      teams[s.homeKey] = { key: s.homeKey, name: `${s.homeKey} Team`, division: 1 }
   })
   return {
      teams,
      groups: { [GROUP_KEY]: { name: 'Golden', teams: Object.keys(teams) } },
      weeks: [{ n: 1, isSpecial: false, isPlayoffs: false, matches: keys.map(name => ({ match_key: matchKey(name) })) }]
   }
}

fixture.setup({ ratings: ratingsFor(SCENARIOS), season: seasonFor(SCENARIOS) })

const { simulate } = require('./helpers/simulate-match')
const matches = require('../model/matches')
const getStandings = require('../lib/get-standings')
const seasons = require('../model/seasons')

const GAME_FIELDS = ['machine', 'player_1', 'player_2', 'player_3', 'player_4', 'score_1', 'score_2', 'score_3', 'score_4',
   'points_1', 'points_2', 'points_3', 'points_4', 'score_13', 'score_24', 'points_13', 'points_24', 'away_points', 'home_points', 'done']

function lineupSnapshot(team) {
   return team.lineup.map(p => ({ name: p.name, num_played: p.num_played || 0 }))
}

function snapshot(match) {
   const points = match.getPoints()

   return {
      state: match.state,
      round: match.round,
      isDone: match.isDone(),
      points,
      away: lineupSnapshot(match.away),
      home: lineupSnapshot(match.home),
      rounds: match.rounds.map(round => ({
         n: round.n,
         done: !!round.done,
         games: round.games.map(game => Object.fromEntries(GAME_FIELDS.filter(f => f in game).map(f => [f, game[f]])))
      }))
   }
}

function standingsSnapshot() {
   return getStandings(seasons.get(), matches).map(group => group.map(team => ({
      key: team.key, n: team.n, wins: team.wins, losses: team.losses, ties: team.ties,
      points: team.points, pops: team.pops, countOfMatches: team.countOfMatches
   })))
}

function assertGolden(name, actual) {
   const file = path.join(GOLDEN_DIR, `${name}.json`)

   if (UPDATE || !fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(actual, null, 2) + '\n')
   }
   assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(fs.readFileSync(file)))
}

describe('ten-player format golden snapshots', () => {
   after(() => fixture.cleanup())

   Object.entries(SCENARIOS).forEach(([name, scenario]) => {
      it(name, () => {
         const match = simulate({ key: matchKey(name), shape: TEN_PLAYER_SHAPE, ...scenario })

         if (scenario.pointAdjust) {
            match.point_adjust = scenario.pointAdjust
            match.save()
         }
         assertGolden(name, snapshot(match))
      })
   })

   it('standings', () => {
      assertGolden('standings', standingsSnapshot())
   })
})
