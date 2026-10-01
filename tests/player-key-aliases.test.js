/*
   Ported from mnp 275f3a3: a player whose name changes keeps their key (and so
   their account, stats, and history) through a name alias. NESLP reads the aliases
   from DATA_FOLDER/player-name-aliases.json instead of a table in lib/make-key.js.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const request = require('supertest')
const fixture = require('./helpers/fixture')

const OLD_NAME = 'Bob Smith'
const NEW_NAME = 'Robert Smith'
const TEAM_KEY = 'ALIAS'
const ALIASES_FILE = 'player-name-aliases.json'
const HTTP_OK = 200

const dataFolder = fixture.setup({
   season: {
      teams: { [TEAM_KEY]: { key: TEAM_KEY, name: 'Alias Team', venue: fixture.VENUE_KEY, roster: [{ name: NEW_NAME }], schedule: [] } },
      groups: { alias: { key: 'alias', name: 'Alias', teams: [TEAM_KEY] } }
   }
})

// Written before lib/make-key is first required, since it reads the file once.
fs.writeFileSync(path.join(dataFolder, ALIASES_FILE), JSON.stringify({
   [NEW_NAME]: OLD_NAME,
   '  Padded NAME  ': '  Old Padded  '
}))

const util = require('../lib/util')
const makeKey = require('../lib/make-key')

describe('player name aliases', () => {
   after(() => fixture.cleanup())

   it('gives a renamed player the key made from their old name', () => {
      assert.equal(makeKey(NEW_NAME), util.digest('bob smith'))
      assert.equal(makeKey(NEW_NAME), makeKey(OLD_NAME))
   })

   it('ignores case and surrounding spaces on both sides of an alias', () => {
      assert.equal(makeKey('padded name'), util.digest('old padded'))
      assert.equal(makeKey('  ROBERT SMITH '), makeKey(OLD_NAME))
   })

   it('leaves names without an alias unchanged', () => {
      assert.equal(makeKey('Other Player'), util.digest('other player'))
   })

   describe('team page', () => {
      let app

      before(() => {
         fixture.createPlayer({ key: makeKey(OLD_NAME), name: OLD_NAME })
         app = fixture.createApp()
      })

      it("links a renamed roster player to their existing account's key", async () => {
         const res = await request(app).get(`/teams/${TEAM_KEY}`)

         assert.equal(res.status, HTTP_OK)
         assert.match(res.text, new RegExp(`href="/players/${util.digest('bob smith')}">${NEW_NAME}<`))
      })
   })
})

describe('player name aliases file problems', () => {
   // lib/make-key reads the file when first loaded, so each case runs in a fresh process.
   function keyInFreshProcess(aliasesContent) {
      const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'neslp-test-aliases-'))

      try {
         if (aliasesContent !== undefined) {
            fs.writeFileSync(path.join(folder, ALIASES_FILE), aliasesContent)
         }
         return spawnSync(process.execPath, ['-e', `process.stdout.write(require('./lib/make-key')(${JSON.stringify(NEW_NAME)}))`], {
            env: { ...process.env, DATA_FOLDER: folder },
            encoding: 'utf8'
         })
      } finally {
         fs.rmSync(folder, { recursive: true, force: true })
      }
   }

   it('uses plain name keys when the file is missing', () => {
      const result = keyInFreshProcess(undefined)

      assert.equal(result.status, 0)
      assert.equal(result.stdout, util.digest('robert smith'))
   })

   it('logs and ignores a file with invalid JSON instead of crashing', () => {
      const result = keyInFreshProcess('{ "Robert Smith": ')

      assert.equal(result.status, 0)
      assert.equal(result.stdout, util.digest('robert smith'))
      assert.match(result.stderr, /Ignoring player name aliases/)
   })
})
