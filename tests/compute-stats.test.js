/*
   util/compute-stats.js, run as in production: only league matches (keyed with
   the branding's prefix) in weeks 1 and up count, a player's side in each game
   follows the round's first picker, and points available come from the game
   type (2.5 in doubles, 3 in singles). Runs under ten-player, and under
   five-player via tests/compute-stats-five.test.js.
*/
const path = require('node:path')
const fivePlayer = !!process.env.FIVE_PLAYER_STATS
process.env.MATCH_FORMAT = fivePlayer ? 'five-player' : 'ten-player'
process.env.BRANDING_FOLDER = path.join(__dirname, '..', 'branding', 'example')

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const fixture = require('./helpers/fixture')
const { rosterFor } = require('./helpers/simulate-match')

const AWAY_KEY = 'CSA'
const HOME_KEY = 'CSH'
const WEEK = 1
const PRESEASON_WEEK = 0
const format = require('../lib/formats')
const scoring = require('../lib/scoring')
const size = format.lineup.max
const roster = [...rosterFor(AWAY_KEY, size), ...rosterFor(HOME_KEY, size)]

const dataFolder = fixture.setup({
   ratings: roster,
   season: {
      teams: {
         [AWAY_KEY]: { key: AWAY_KEY, name: 'Away Team', division: 1 },
         [HOME_KEY]: { key: HOME_KEY, name: 'Home Team', division: 1 }
      }
   }
})

const { simulate } = require('./helpers/simulate-match')
const brand = require('../lib/branding')
const makeKey = require('../lib/make-key')

const LEAGUE_KEY = `${brand.matchKeyPrefix}-1-${WEEK}-${AWAY_KEY}-${HOME_KEY}`
const PRESEASON_KEY = `${brand.matchKeyPrefix}-1-${PRESEASON_WEEK}-${AWAY_KEY}-${HOME_KEY}`
const SCRIMMAGE_KEY = `other-1-${WEEK}-${AWAY_KEY}-${HOME_KEY}`

function readStats(playerKey) {
   return JSON.parse(fs.readFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'stats', playerKey)))
}

// What a player won, and could have won, across the regular rounds of a match.
function expectedPoints(match, playerKey) {
   let won = 0
   let of = 0

   match.rounds.forEach(round => {
      const spec = format.roundSpec(round.n)
      if (!spec || format.isTieBreaker(round.n)) return
      round.games.forEach(game => {
         for (let slot = 1; slot <= spec.playersPerGame; slot++) {
            if (game[`player_${slot}`] === playerKey) {
               won += game[`points_${slot}`]
               of += scoring.pointsAvailable(spec)
            }
         }
      })
   })
   return { won, of }
}

describe(`compute-stats under ${format.name}`, () => {
   let league

   before(() => {
      // The roster file names players who have no account.
      fs.writeFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'rosters.csv'),
         roster.map(p => `${p.name.toLowerCase()},${p.name},${p.name.startsWith(AWAY_KEY) ? AWAY_KEY : HOME_KEY},P\n`).join(''))
      league = simulate({ key: LEAGUE_KEY, shape: format.rounds, awaySize: size, homeSize: size, awayKey: AWAY_KEY, homeKey: HOME_KEY, awayIprs: roster.map(r => r.ipr) })
      simulate({ key: PRESEASON_KEY, shape: format.rounds, awaySize: size, homeSize: size, awayKey: AWAY_KEY, homeKey: HOME_KEY })
      simulate({ key: SCRIMMAGE_KEY, shape: format.rounds, awaySize: size, homeSize: size, awayKey: AWAY_KEY, homeKey: HOME_KEY })

      const result = spawnSync(process.execPath, ['--require', fixture.STUB_EMAIL_PRELOAD, 'util/compute-stats.js'], {
         env: process.env, encoding: 'utf8'
      })
      assert.equal(result.status, 0, result.stderr)
   })

   after(() => fixture.cleanup())

   it('counts only the league match, in weeks 1 and up', () => {
      const stats = readStats(makeKey(roster[0].name))

      assert.equal(stats.divisions.all.num_matches, 1)
      assert.ok(stats.history.every(item => item.match === LEAGUE_KEY))
   })

   it('puts each player on their own side in every round', () => {
      const awayKey = makeKey(roster[0].name)
      const homeKey = makeKey(roster[size].name)

      assert.ok(readStats(awayKey).history.every(item => item.team === AWAY_KEY && item.opp === HOME_KEY))
      assert.ok(readStats(homeKey).history.every(item => item.team === HOME_KEY && item.opp === AWAY_KEY))
      assert.ok(readStats(awayKey).history.length >= format.participationBonus.roundsForCredit)
   })

   it('totals points won and available from the game types', () => {
      roster.forEach(p => {
         const key = makeKey(p.name)
         const expected = expectedPoints(league, key)

         assert.deepEqual(readStats(key).divisions.all.points, expected, p.name)
         assert.equal(readStats(key).name, p.name)
      })
   })
})
