/*
   /matches/reload (and /matches/spawn, which does the same) reloads every match
   file from disk. Only league admins may trigger it; others are redirected to
   /matches with nothing reloaded.
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

const HTTP_FOUND = 302
const MATCH_KEY = 'slp-test-9-RLA-RLH'
const PLAYER_KEY = 'reload-player'
const MATCH_FILE = path.join(dataFolder, fixture.TEST_SEASON, 'matches', `${MATCH_KEY}.json`)

// Simulates an admin editing the match file on disk after the server loaded it.
function editMatchFile(adjust) {
   const json = JSON.parse(fs.readFileSync(MATCH_FILE))

   json.point_adjust = adjust
   fs.writeFileSync(MATCH_FILE, JSON.stringify(json))
}

describe('reloading matches from disk', () => {
   let app

   before(() => {
      new matches.Match({
         key: MATCH_KEY,
         state: CONST.PREGAME,
         venue: fixture.VENUE_KEY,
         away: { key: 'RLA', name: 'Reload Away' },
         home: { key: 'RLH', name: 'Reload Home' }
      }).save()
      matches.get(MATCH_KEY) // cache it, as the running server would have
      fixture.createPlayer({ key: PLAYER_KEY, name: 'Reload Player' })
      app = fixture.createApp()
   })

   after(() => fixture.cleanup())

   for (const path of ['/matches/reload', '/matches/spawn']) {
      it(`${path} does nothing for visitors and regular players`, async () => {
         editMatchFile({ home_points: 1, away_points: 0 })

         const anonymous = await request(app).get(path)
         const player = await request(app).get(path).set('Cookie', fixture.login(PLAYER_KEY))

         assert.equal(anonymous.status, HTTP_FOUND)
         assert.equal(player.status, HTTP_FOUND)
         assert.equal(matches.get(MATCH_KEY).point_adjust, undefined)
      })

      it(`${path} reloads match files for a league admin`, async () => {
         const adjust = { home_points: 2, away_points: 0 }
         editMatchFile(adjust)

         const res = await request(app).get(path).set('Cookie', fixture.login(fixture.ADMIN_KEY))

         assert.equal(res.status, HTTP_FOUND)
         assert.equal(res.headers.location, '/matches/')
         assert.deepEqual(matches.get(MATCH_KEY).point_adjust, adjust)

         // Reset for the next route's tests.
         editMatchFile(undefined)
         await request(app).get(path).set('Cookie', fixture.login(fixture.ADMIN_KEY))
      })
   }
})

describe('lib/admins isAdmin', () => {
   const { isAdmin } = require('../lib/admins')

   it('accepts ROOT and LEAGUE_ADMINS keys', () => {
      assert.equal(isAdmin(CONST.ROOT), true)
      assert.equal(isAdmin(fixture.ADMIN_KEY), true)
   })

   it('rejects other keys and missing keys', () => {
      assert.equal(isAdmin(PLAYER_KEY), false)
      assert.equal(isAdmin(undefined), false)
      assert.equal(isAdmin(''), false)
   })
})
