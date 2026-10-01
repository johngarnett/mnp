/*
   Ported from mnp 7626759 (week 0 matches are excluded from player stats) and
   7e758fb (the player page lists history sorted by week). Runs util/compute-stats.js
   the way it is run in production, then checks the stats files and player page.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const matches = require('../model/matches')
const players = require('../model/players')

const HTTP_OK = 200
const PLAYER_NAME = 'Stats Player'
const OPPONENT_NAME = 'Stats Opponent'
const PLAYER_KEY = players.makeKey(PLAYER_NAME)
const OPPONENT_KEY = players.makeKey(OPPONENT_NAME)
const SEASON_NUMBER = 1
const PRESEASON_WEEK = '0'
// Out of filename order (slp-1-10 sorts before slp-1-2) to catch an unsorted history.
const LEAGUE_WEEKS = ['1', '10', '2']
const SORTED_LEAGUE_WEEKS = ['1', '2', '10']
const SINGLES_ROUND_INDEX = 1
const WINNER_POINTS = 3
const WINNER_SCORE = 1000000
const LOSER_SCORE = 500000

function createPlayedMatch(week) {
   const match = new matches.Match({
      key: `slp-${SEASON_NUMBER}-${week}-AWAY-HOME`,
      week,
      venue: fixture.VENUE_KEY,
      away: { key: 'AWAY', name: 'Away Team', roster: [{ name: PLAYER_NAME }] },
      home: { key: 'HOME', name: 'Home Team', roster: [{ name: OPPONENT_NAME }] }
   })
   const game = match.rounds[SINGLES_ROUND_INDEX].games[0]

   Object.assign(game, {
      machine: fixture.VENUE_MACHINES[0],
      player_1: PLAYER_KEY,
      player_2: OPPONENT_KEY,
      score_1: WINNER_SCORE,
      score_2: LOSER_SCORE,
      points_1: WINNER_POINTS,
      points_2: 0
   })
   match.save()
}

function runComputeStats() {
   return spawnSync(process.execPath, ['--require', fixture.STUB_EMAIL_PRELOAD, 'util/compute-stats.js'], {
      env: process.env,
      encoding: 'utf8'
   })
}

function readStats(playerKey) {
   return JSON.parse(fs.readFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'stats', playerKey)))
}

describe('player stats by week', () => {
   let app

   before(() => {
      fs.writeFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'rosters.csv'), '')
      ;[PRESEASON_WEEK, ...LEAGUE_WEEKS].forEach(createPlayedMatch)

      const result = runComputeStats()
      assert.equal(result.status, 0, result.stderr)

      // model/stats loads the stats folder when first required, so build the app afterwards.
      app = fixture.createApp()
   })

   after(() => fixture.cleanup())

   it('compute-stats excludes week 0 matches', () => {
      const weeks = readStats(PLAYER_KEY).history.map(item => item.week)

      assert.deepEqual([...weeks].sort(), [...LEAGUE_WEEKS].sort())
   })

   it('player page lists history in week order', async () => {
      const res = await request(app).get(`/players/${PLAYER_KEY}`)
      const weekCells = [...res.text.matchAll(/<tr class="history-row"[\s\S]*?<td class="text-xs-center">(\d+)<\/td>/g)]
         .map(m => m[1])

      assert.equal(res.status, HTTP_OK)
      assert.deepEqual(weekCells, SORTED_LEAGUE_WEEKS)
   })
})
