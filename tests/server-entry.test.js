/*
   lib/server.js: TLS=proxy serves plain HTTP on PORT, TRUST_PROXY makes the
   app honour X-Forwarded-* headers (so email links get the right scheme), and
   TLS=internal needs the certificate files.
*/
process.env.TLS = 'proxy'
process.env.TRUST_PROXY = 'loopback'

process.env.BRANDING_FOLDER = require('node:path').join(__dirname, '..', 'branding', 'example')
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const HTTP_OK = 200
const SIGNUP_EMAIL = 'proxied.person@example.com'

fixture.setup()

const server = require('../lib/server')
const brand = require('../lib/branding')

function todaysPin() {
   const now = new Date()
   const pad = n => String(n).padStart(2, '0')
   return String(now.getFullYear() % 100) + pad(now.getMonth() + 1) + pad(now.getDate())
}

function fetchText(url) {
   return new Promise((resolve, reject) => {
      http.get(url, res => {
         const chunks = []
         res.on('data', c => chunks.push(c))
         res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString() }))
      }).on('error', reject)
   })
}

describe('server entry', () => {
   after(() => fixture.cleanup())

   it('parses TRUST_PROXY', () => {
      assert.equal(server.trustProxySetting(undefined), false)
      assert.equal(server.trustProxySetting('true'), true)
      assert.equal(server.trustProxySetting('2'), 2)
      assert.equal(server.trustProxySetting('loopback'), 'loopback')
   })

   it('honours X-Forwarded-Proto in email links when TRUST_PROXY is set', async () => {
      const app = server.createApp()

      await request(app).post('/signup').set('X-Forwarded-Proto', 'https').type('form').send({
         name: 'Proxied Person', email: SIGNUP_EMAIL, answerX: todaysPin(), questionX: 'pin'
      })
      const sent = fixture.sentEmails.find(e => e.to === SIGNUP_EMAIL)

      assert.ok(sent, 'a verification email was sent')
      assert.ok(sent.message.includes('https://127.0.0.1/verify/'))
   })

   it('serves plain HTTP on PORT with TLS=proxy', async () => {
      process.env.PORT = '0'
      require('../config').PORT = '0'
      const listening = server.start()

      await new Promise(resolve => listening.on('listening', resolve))
      const { port } = listening.address()
      const res = await fetchText(`http://127.0.0.1:${port}/`)

      listening.close()
      assert.equal(res.status, HTTP_OK)
      assert.ok(res.text.includes(brand.name))
   })
})
