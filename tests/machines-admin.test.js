/*
   Ported from mnp 9be307d: league admins (not just ROOT) can add and remove
   machines. NESLP also cleans machine codes on the server (uppercase letters and
   digits, at most 20) and ignores adds with a blank code or name.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const HTTP_OK = 200
const HTTP_FOUND = 302
const PLAYER_KEY = 'regular-player'
const MACHINE_KEY_MAX_LENGTH = 20

function savedMachines() {
   return JSON.parse(fs.readFileSync(path.join(dataFolder, 'machines.json')))
}

describe('machines page editing', () => {
   let app
   let adminCookie
   let playerCookie

   before(() => {
      fixture.createPlayer({ key: PLAYER_KEY, name: 'Regular Player' })
      app = fixture.createApp()
      adminCookie = fixture.login(fixture.ADMIN_KEY)
      playerCookie = fixture.login(PLAYER_KEY)
   })

   after(() => fixture.cleanup())

   function addMachine(cookie, mkey, name) {
      const req = request(app).post('/machines').type('form').send({ mkey, name })

      return cookie ? req.set('Cookie', cookie) : req
   }

   function removeMachine(cookie, mkey) {
      const req = request(app).post(`/machines/${mkey}/remove`).type('form').send({ mkey })

      return cookie ? req.set('Cookie', cookie) : req
   }

   it('shows the add form and remove buttons to a league admin', async () => {
      const res = await request(app).get('/machines').set('Cookie', adminCookie)

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, /<form action="\/machines" method="POST">/)
      assert.match(res.text, /\/remove" method="POST"/)
   })

   it('hides the add form and remove buttons from other players', async () => {
      const res = await request(app).get('/machines').set('Cookie', playerCookie)

      assert.doesNotMatch(res.text, /<form action="\/machines" method="POST">/)
      assert.doesNotMatch(res.text, /\/remove" method="POST"/)
   })

   it('lets a league admin add a machine', async () => {
      const res = await addMachine(adminCookie, 'GZ', 'Godzilla')

      assert.equal(res.status, HTTP_FOUND)
      assert.deepEqual(savedMachines().GZ, { key: 'GZ', name: 'Godzilla' })
   })

   it('cleans the machine code and trims the name', async () => {
      await addMachine(adminCookie, ' twilight zone! ', '  Twilight Zone  ')

      assert.deepEqual(savedMachines().TWILIGHTZONE, { key: 'TWILIGHTZONE', name: 'Twilight Zone' })
   })

   it('limits the machine code length', async () => {
      const longCode = 'A'.repeat(MACHINE_KEY_MAX_LENGTH + 5)

      await addMachine(adminCookie, longCode, 'Long Code')

      assert.ok(savedMachines()['A'.repeat(MACHINE_KEY_MAX_LENGTH)])
      assert.equal(savedMachines()[longCode], undefined)
   })

   it('ignores an add with a blank code or name', async () => {
      const before = savedMachines()

      await addMachine(adminCookie, '!!!', 'No Code')
      await addMachine(adminCookie, 'NONAME', '   ')

      assert.deepEqual(savedMachines(), before)
   })

   it('lets a league admin remove a machine', async () => {
      const key = fixture.VENUE_MACHINES[2]

      assert.ok(savedMachines()[key])
      await removeMachine(adminCookie, key)

      assert.equal(savedMachines()[key], undefined)
   })

   it('ignores adds and removes from other players and anonymous visitors', async () => {
      const before = savedMachines()

      await addMachine(playerCookie, 'HACK', 'Player Add')
      await addMachine(null, 'ANON', 'Anonymous Add')
      await removeMachine(playerCookie, fixture.VENUE_MACHINES[0])
      await removeMachine(null, fixture.VENUE_MACHINES[1])

      assert.deepEqual(savedMachines(), before)
   })
})
