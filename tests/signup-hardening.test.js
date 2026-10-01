/*
   Ported from mnp 9ca73ac, 5b0433e, e49b8c0, and f5ba033 (sign-up hardening), plus
   NESLP changes: the PIN is the date in the league's time zone, and a rejected
   sign-up shows one generic error with the entered name and email kept.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const players = require('../model/players')
const util = require('../lib/util')

const HTTP_OK = 200
const MAX_NAME_LENGTH = 50
// Noon Pacific on 2026-10-01, when the UTC and Pacific dates agree.
const NOON_PACIFIC = new Date('2026-10-01T19:00:00Z')
const NOON_PIN = '261001'
const THANKS_TEXT = 'Thanks for signing up'
const ERROR_TEXT = 'Sign-up failed.'

let emailCount = 0

function uniqueEmail() {
   emailCount++
   return `player${emailCount}@example.com`
}

function playerExists(name) {
   return fs.existsSync(path.join(dataFolder, 'players', players.makeKey(name)))
}

function emailsTo(address) {
   return fixture.sentEmails.filter(e => e.to === address)
}

describe('POST /signup', () => {
   let app

   before(() => {
      app = fixture.createApp()
   })

   after(() => fixture.cleanup())

   // Freezes the clock at `now` and submits the sign-up form.
   async function signup(t, fields, now = NOON_PACIFIC) {
      t.mock.timers.enable({ apis: ['Date'], now })

      return request(app)
         .post('/signup')
         .type('form')
         .send({ signup_reason: 'account', answerX: NOON_PIN, ...fields })
   }

   function assertRejected(res, name, email) {
      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(ERROR_TEXT))
      assert.doesNotMatch(res.text, new RegExp(THANKS_TEXT))
      assert.equal(emailsTo(email).length, 0)
      if (name) assert.equal(playerExists(name), false)
   }

   it('accepts a full name with accents, apostrophes, and hyphens', async t => {
      const name = "Zoë O'Brien-Smith"
      const email = uniqueEmail()
      const res = await signup(t, { name, email })

      assert.equal(res.status, HTTP_OK)
      assert.match(res.text, new RegExp(THANKS_TEXT))
      assert.equal(playerExists(name), true)
      assert.equal(emailsTo(email).length, 1)
   })

   it('accepts a PIN with surrounding spaces', async t => {
      const name = 'Spacey Pin'
      const res = await signup(t, { name, email: uniqueEmail(), answerX: ` ${NOON_PIN} ` })

      assert.match(res.text, new RegExp(THANKS_TEXT))
   })

   it('rejects a wrong PIN and keeps the entered name and email', async t => {
      const name = 'Wrong Pin'
      const email = uniqueEmail()
      const res = await signup(t, { name, email, answerX: '000000' })

      assertRejected(res, name, email)
      assert.match(res.text, new RegExp(`value="${name}"`))
      assert.match(res.text, new RegExp(`value="${email}"`))
   })

   it('rejects a missing PIN', async t => {
      const name = 'No Pin'
      const email = uniqueEmail()
      const res = await signup(t, { name, email, answerX: '' })

      assertRejected(res, name, email)
   })

   for (const [label, name] of [
      ['a single-word name', 'Cher'],
      ['a name with a comma', 'Smith, Bob'],
      ['a name with angle brackets', 'Bob <b>Smith</b>'],
      ['a name over the length limit', `Long ${'x'.repeat(MAX_NAME_LENGTH)}`]
   ]) {
      it(`rejects ${label}`, async t => {
         const email = uniqueEmail()
         const res = await signup(t, { name, email })

         assertRejected(res, name, email)
      })
   }

   it('rejects an empty name', async t => {
      const email = uniqueEmail()
      const res = await signup(t, { name: '', email })

      assertRejected(res, null, email)
   })

   for (const email of ['bot@example.ru', 'bot@example.de']) {
      it(`rejects a blocked email address (${email})`, async t => {
         const name = `Blocked ${email.slice(-2).toUpperCase()}`
         const res = await signup(t, { name, email })

         assertRejected(res, name, email)
      })
   }

   it('escapes the redisplayed name', async t => {
      const res = await signup(t, { name: 'Bob <script>x</script>', email: uniqueEmail() })

      assert.doesNotMatch(res.text, /value="Bob <script>/)
   })
})

describe('sign-up PIN uses the league time zone', () => {
   // [description, instant, Pacific date PIN, UTC date PIN]
   const CASES = [
      ['5:30 pm PDT, after the UTC date changes', '2026-10-02T00:30:00Z', '261001', '261002'],
      ['5:00 pm PST, after the UTC date changes', '2026-12-04T01:00:00Z', '261203', '261204'],
      ['just after midnight PDT', '2026-10-01T07:05:00Z', '261001', '261001']
   ]

   for (const [label, instant, pacificPin] of CASES) {
      it(`is the Pacific date at ${label}`, () => {
         assert.equal(players.getCorrectAnswer(new Date(instant)), pacificPin)
      })
   }

   it('defaults to the server clock in the league time zone', t => {
      const [, instant, pacificPin, utcPin] = CASES[0]

      t.mock.timers.enable({ apis: ['Date'], now: new Date(instant) })
      assert.equal(players.getCorrectAnswer(), pacificPin)
      assert.notEqual(players.getCorrectAnswer(), utcPin)
   })
})

describe('util.isBannedEmail', () => {
   const CASES = [
      ['player@example.com', false],
      ['a@b.c', false],
      ['a@bc', true],
      ['player@example.ru', true],
      ['player@example.de', true],
      ['no-at-sign.com', true],
      ['', true]
   ]

   for (const [email, banned] of CASES) {
      it(`${banned ? 'bans' : 'allows'} "${email}"`, () => {
         assert.equal(util.isBannedEmail(email), banned)
      })
   }
})
