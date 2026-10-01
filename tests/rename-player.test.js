/*
   util/rename-player.js moves a player's account to the key made from their new
   name. When a name alias (player-name-aliases.json) gives the new name the same
   key, it must stop: moving would save and then delete the same account file.
*/
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const ALIASED_OLD = 'Bob Smith'
const ALIASED_NEW = 'Robert Smith'
const PLAIN_OLD = 'Pat Plain'
const PLAIN_NEW = 'Pat Newname'
const SHADOW = 'not-a-real-password-hash'

fs.writeFileSync(path.join(dataFolder, 'player-name-aliases.json'), JSON.stringify({ [ALIASED_NEW]: ALIASED_OLD }))

const util = require('../lib/util')

// Keys made the way lib/make-key does without aliases.
function plainKey(name) {
   return util.digest(name.trim().toLowerCase())
}

function addAccount(name) {
   const key = plainKey(name)

   fixture.createPlayer({ key, name })
   fs.appendFileSync(path.join(dataFolder, '.shadows'), `${key},${SHADOW}\n`)
   return key
}

function runRename(fromName, toName) {
   return spawnSync(process.execPath, ['--require', fixture.STUB_EMAIL_PRELOAD, 'util/rename-player.js', fromName, toName], {
      env: process.env,
      encoding: 'utf8'
   })
}

function accountExists(key) {
   return fs.existsSync(path.join(dataFolder, 'players', key))
}

function hasPassword(key) {
   return fs.readFileSync(path.join(dataFolder, '.shadows'), 'utf8').includes(`${key},${SHADOW}`)
}

describe('util/rename-player.js', () => {
   after(() => fixture.cleanup())

   it('keeps the account when an alias gives the new name the same key', () => {
      const key = addAccount(ALIASED_OLD)
      const result = runRename(ALIASED_OLD, ALIASED_NEW)

      assert.equal(result.status, 1)
      assert.match(result.stdout, /has the same key/)
      assert.equal(accountExists(key), true)
      assert.equal(hasPassword(key), true)
   })

   it('moves an account and its password to the new name key', () => {
      const oldKey = addAccount(PLAIN_OLD)
      const newKey = plainKey(PLAIN_NEW)
      const result = runRename(PLAIN_OLD, PLAIN_NEW)

      assert.equal(result.status, 0, result.stderr)
      assert.equal(accountExists(oldKey), false)
      assert.equal(accountExists(newKey), true)
      assert.equal(hasPassword(newKey), true)
   })
})
