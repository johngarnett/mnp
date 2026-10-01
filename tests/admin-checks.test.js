/*
   Roster editing on team pages and machine editing on venue pages are allowed
   only for league admins (lib/admins isAdmin). Regular players and visitors are
   redirected with nothing changed.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const TEAM_KEY = 'ADM'
const PLAYER_KEY = 'checks-player'
const NEW_MACHINE = 'NEWM'

const dataFolder = fixture.setup({
   season: {
      teams: { [TEAM_KEY]: { key: TEAM_KEY, name: 'Admin Team', venue: fixture.VENUE_KEY, roster: [{ name: 'Kept Player' }], schedule: [] } },
      groups: { adm: { key: 'adm', name: 'Admin', teams: [TEAM_KEY] } }
   }
})

const players = require('../model/players')

function savedRosterNames() {
   const season = JSON.parse(fs.readFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'season.json')))

   return season.teams[TEAM_KEY].roster.map(p => p.name)
}

function savedVenueMachines() {
   return JSON.parse(fs.readFileSync(path.join(dataFolder, 'venues.json')))[fixture.VENUE_KEY].machines
}

describe('admin-only editing', () => {
   let app
   let adminCookie
   let playerCookie

   before(() => {
      fixture.createPlayer({ key: PLAYER_KEY, name: 'Checks Player' })
      app = fixture.createApp()
      adminCookie = fixture.login(fixture.ADMIN_KEY)
      playerCookie = fixture.login(PLAYER_KEY)
   })

   after(() => fixture.cleanup())

   function post(url, body, cookie) {
      const req = request(app).post(url).type('form').send(body)

      return cookie ? req.set('Cookie', cookie) : req
   }

   it('ignores roster changes from regular players and visitors', async () => {
      await post(`/teams/${TEAM_KEY}/roster/add`, { name: 'Sneaky Add', role: 'P' }, playerCookie)
      await post(`/teams/${TEAM_KEY}/roster/add`, { name: 'Anon Add', role: 'P' })
      await post(`/teams/${TEAM_KEY}/roster/remove`, { key: players.makeKey('Kept Player') }, playerCookie)

      assert.deepEqual(savedRosterNames(), ['Kept Player'])
   })

   it('lets a league admin add and remove roster players', async () => {
      await post(`/teams/${TEAM_KEY}/roster/add`, { name: 'Added Player', role: 'P' }, adminCookie)
      assert.deepEqual(savedRosterNames(), ['Kept Player', 'Added Player'])

      await post(`/teams/${TEAM_KEY}/roster/remove`, { key: players.makeKey('Added Player') }, adminCookie)
      assert.deepEqual(savedRosterNames(), ['Kept Player'])
   })

   it('ignores venue machine changes from regular players and visitors', async () => {
      await post(`/venues/${fixture.VENUE_KEY}/add`, { mkey: NEW_MACHINE }, playerCookie)
      await post(`/venues/${fixture.VENUE_KEY}/add`, { mkey: NEW_MACHINE })

      assert.equal(savedVenueMachines().includes(NEW_MACHINE), false)
   })

   it('lets a league admin add a machine to a venue', async () => {
      await post(`/venues/${fixture.VENUE_KEY}/add`, { mkey: NEW_MACHINE }, adminCookie)

      assert.equal(savedVenueMachines().includes(NEW_MACHINE), true)
   })
})
