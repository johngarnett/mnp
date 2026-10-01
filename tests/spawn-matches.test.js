/*
   util/spawn-matches.js picks the current week from the 9 pm cutoff on match day in
   the league's time zone (lib/league-time), not the server's clock zone. It also
   reports a missing week instead of crashing.
*/
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')
const { zonedTime, findCurrentWeek } = require('../lib/league-time')

const PACIFIC = 'America/Los_Angeles'
const CUTOFF_HOUR = 21

describe('lib/league-time zonedTime', () => {
   const CASES = [
      ['summer (PDT, UTC-7)', '10/01/2026', PACIFIC, '2026-10-02T04:00:00.000Z'],
      ['winter (PST, UTC-8)', '12/03/2026', PACIFIC, '2026-12-04T05:00:00.000Z'],
      ['the day daylight saving starts', '03/08/2026', PACIFIC, '2026-03-09T04:00:00.000Z'],
      ['the day daylight saving ends', '11/01/2026', PACIFIC, '2026-11-02T05:00:00.000Z'],
      ['another time zone', '10/01/2026', 'America/New_York', '2026-10-02T01:00:00.000Z'],
      ['UTC', '10/01/2026', 'UTC', '2026-10-01T21:00:00.000Z']
   ]

   for (const [label, date, timeZone, expected] of CASES) {
      it(`gives 9 pm local time: ${label}`, () => {
         assert.equal(zonedTime(date, CUTOFF_HOUR, timeZone).toISOString(), expected)
      })
   }
})

describe('lib/league-time findCurrentWeek', () => {
   const WEEKS = [{ n: '1', date: '10/01/2026' }, { n: '2', date: '10/08/2026' }]

   function weekAt(instant) {
      return findCurrentWeek(WEEKS, new Date(instant), PACIFIC, CUTOFF_HOUR).n
   }

   it('keeps match day current at 3 pm Pacific, after 9 pm UTC has passed', () => {
      // A server using its own UTC clock would already have moved on to week 2.
      assert.equal(weekAt('2026-10-01T22:00:00Z'), '1')
   })

   it('moves to the next week after 9 pm Pacific on match day', () => {
      assert.equal(weekAt('2026-10-02T04:30:00Z'), '2')
   })

   it('returns nothing after the last week', () => {
      assert.equal(findCurrentWeek(WEEKS, new Date('2026-10-09T05:00:00Z'), PACIFIC, CUTOFF_HOUR), undefined)
   })
})

describe('util/spawn-matches.js', () => {
   const PAST_KEY = 'slp-1-1-TESTV-AAA-BBB'
   const FUTURE_KEY = 'slp-1-2-TESTV-BBB-AAA'
   const BYE_KEY = 'slp-1-2-TESTV-BYE-AAA'

   function team(key) {
      return { key, name: `${key} Team`, venue: fixture.VENUE_KEY, roster: [{ name: `${key} Player` }], captain: `${key} Player` }
   }

   function matchInfo(key, away, home) {
      return { match_key: key, away_key: away, home_key: home, venue: { key: fixture.VENUE_KEY, name: 'Test Venue' } }
   }

   const dataFolder = fixture.setup({
      season: {
         teams: { AAA: team('AAA'), BBB: team('BBB') },
         weeks: [
            { n: '1', code: 'WK1', date: '01/01/2020', matches: [matchInfo(PAST_KEY, 'AAA', 'BBB')] },
            { n: '2', code: 'WK2', date: '01/07/2099', matches: [matchInfo(FUTURE_KEY, 'BBB', 'AAA'), matchInfo(BYE_KEY, 'BYE', 'AAA')] }
         ]
      }
   })
   const matchesFolder = path.join(dataFolder, fixture.TEST_SEASON, 'matches')

   after(() => fixture.cleanup())

   function runSpawn(...args) {
      return spawnSync(process.execPath, ['--require', fixture.STUB_EMAIL_PRELOAD, 'util/spawn-matches.js', ...args], {
         env: process.env,
         encoding: 'utf8'
      })
   }

   function matchFile(key) {
      return path.join(matchesFolder, `${key}.json`)
   }

   it('spawns the upcoming week and skips BYE matches', () => {
      const result = runSpawn()

      assert.equal(result.status, 0, result.stderr)
      assert.equal(fs.existsSync(matchFile(FUTURE_KEY)), true)
      assert.equal(fs.existsSync(matchFile(BYE_KEY)), false)
      assert.equal(fs.existsSync(matchFile(PAST_KEY)), false)
   })

   it('spawns the week given as an argument, with lineups and captains from the rosters', () => {
      const result = runSpawn('1')
      const match = JSON.parse(fs.readFileSync(matchFile(PAST_KEY)))

      assert.equal(result.status, 0, result.stderr)
      assert.equal(match.week, '1')
      assert.deepEqual(match.away.lineup.map(p => p.name), ['AAA Player'])
      assert.deepEqual(match.away.captains.map(p => p.name), ['AAA Player'])
   })

   it('never overwrites a match that already has a file', () => {
      const file = matchFile(FUTURE_KEY)
      const edited = { ...JSON.parse(fs.readFileSync(file)), point_adjust: { home_points: 1, away_points: 0 } }
      fs.writeFileSync(file, JSON.stringify(edited))

      runSpawn('2')

      assert.deepEqual(JSON.parse(fs.readFileSync(file)).point_adjust, { home_points: 1, away_points: 0 })
   })

   it('reports an unknown week instead of crashing', () => {
      const result = runSpawn('99')

      assert.equal(result.status, 1)
      assert.match(result.stderr, /No week 99 in the season/)
   })
})
