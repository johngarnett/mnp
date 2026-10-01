/*
   Ported from mnp 3243741, f237a44, and b3c66ab: the POST log (DATA_FOLDER/posts)
   adds the match key, state, and round to entries for match and game posts, adds
   the game number to score reports, and writes an extra "lineups" entry with both
   lineups when the final lineup confirmation starts a match.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const CONST = require('../constants')
const matches = require('../model/matches')

const PICKING_KEY = 'slp-test-5-LOGA-LOGH'
const FINAL_CONFIRM_KEY = 'slp-test-6-LOGA-LOGH'
const FIRST_CONFIRM_KEY = 'slp-test-7-LOGA-LOGH'
const ROUND_ONE = 1
const REPORTED_ROUND = 2
const REPORTED_GAME = 3

function createMatch(key, state, setup = () => {}) {
   const match = new matches.Match({
      key,
      state,
      venue: fixture.VENUE_KEY,
      away: { key: 'LOGA', name: 'Log Away', roster: [{ name: 'Away One' }, { name: 'Away Two' }] },
      home: { key: 'LOGH', name: 'Log Home', roster: [{ name: 'Home One' }, { name: 'Home Two' }] }
   })

   setup(match)
   match.save()
   return match
}

function logEntries() {
   const folder = path.join(dataFolder, 'posts')

   return fs.readdirSync(folder).map(file => JSON.parse(fs.readFileSync(path.join(folder, file))))
}

function entriesFor(logPath) {
   return logEntries().filter(entry => entry.path === logPath)
}

describe('POST log', () => {
   let app
   let cookie

   before(() => {
      createMatch(PICKING_KEY, CONST.PICKING)
      // Both lineups are ready and the away captain has confirmed the home lineup,
      // so the home captain's confirmation is the final one.
      createMatch(FINAL_CONFIRM_KEY, CONST.PREGAME, match => {
         match.away.ready = true
         match.home.ready = true
         match.home.confirmed = { by: 'Away Captain', at: Date.now() }
      })
      createMatch(FIRST_CONFIRM_KEY, CONST.PREGAME, match => {
         match.away.ready = true
         match.home.ready = true
      })
      app = fixture.createApp()
      cookie = fixture.login(fixture.ADMIN_KEY)
   })

   after(() => fixture.cleanup())

   function post(url, body) {
      return request(app).post(url).set('Cookie', cookie).type('form').send(body)
   }

   it('adds the match key, state, and round to match posts', async () => {
      await post(`/matches/${PICKING_KEY}/venue/add`, { machine: fixture.VENUE_MACHINES[0] })

      const [entry] = entriesFor(`/matches/${PICKING_KEY}/venue/add`)
      assert.equal(entry.body.key, PICKING_KEY)
      assert.equal(entry.body.state, CONST.PICKING)
      assert.equal(entry.body.round, ROUND_ONE)
      assert.equal(entry.body.machine, fixture.VENUE_MACHINES[0])
      assert.equal(entry.ukey, fixture.ADMIN_KEY)
   })

   it('keeps values the post itself sent over the match values', async () => {
      await post(`/matches/${PICKING_KEY}/picks`, { state: CONST.PLAYING, round: '9' })

      const [entry] = entriesFor(`/matches/${PICKING_KEY}/picks`)
      assert.equal(entry.body.key, PICKING_KEY)
      assert.equal(entry.body.state, CONST.PLAYING)
      assert.equal(entry.body.round, '9')
   })

   it('adds the game number to score reports', async () => {
      const reportPath = `/games/${PICKING_KEY}.${REPORTED_ROUND}.${REPORTED_GAME}/report`

      await post(reportPath, { score_1: '100' })

      const [entry] = entriesFor(reportPath)
      assert.equal(entry.body.key, PICKING_KEY)
      assert.equal(entry.body.game, String(REPORTED_GAME))
      assert.equal(entry.body.score_1, '100')
   })

   it('logs both lineups when the final confirmation starts the match', async () => {
      await post(`/matches/${FINAL_CONFIRM_KEY}/confirm`, { right: '1' })

      const [lineups] = entriesFor(`/matches/${FINAL_CONFIRM_KEY}/lineups`)
      assert.ok(lineups, 'expected a lineups entry')
      assert.deepEqual(lineups.body.away.map(p => p.name), ['Away One', 'Away Two'])
      assert.deepEqual(lineups.body.home.map(p => p.name), ['Home One', 'Home Two'])
      assert.equal(lineups.body.venue.key, fixture.VENUE_KEY)
      assert.equal(lineups.body.key, FINAL_CONFIRM_KEY)
      assert.equal(entriesFor(`/matches/${FINAL_CONFIRM_KEY}/confirm`).length, 1)
      assert.equal(matches.get(FINAL_CONFIRM_KEY).state, CONST.PICKING)
   })

   it('does not log lineups for the first confirmation', async () => {
      await post(`/matches/${FIRST_CONFIRM_KEY}/confirm`, { right: '1' })

      assert.equal(entriesFor(`/matches/${FIRST_CONFIRM_KEY}/confirm`).length, 1)
      assert.equal(entriesFor(`/matches/${FIRST_CONFIRM_KEY}/lineups`).length, 0)
   })

   it('logs posts for unknown matches and non-match pages unchanged', async () => {
      await post('/matches/slp-unknown/picks', { round: '1' })
      await post('/machines', { mkey: 'LOGTEST', name: 'Log Test' })

      const [unknown] = entriesFor('/matches/slp-unknown/picks')
      const [machine] = entriesFor('/machines')
      assert.deepEqual(unknown.body, { round: '1' })
      assert.deepEqual(machine.body, { mkey: 'LOGTEST', name: 'Log Test' })
   })
})
