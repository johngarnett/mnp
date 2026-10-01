/*
   Ported from mnp 35327e8: player stats live in DATA_FOLDER/<season>/stats instead
   of DATA_FOLDER/stats, so each season has its own. NESLP also creates the season's
   stats folder if it is missing, so starting a new season doesn't crash the server.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const SEASON_STATS = path.join(dataFolder, fixture.TEST_SEASON, 'stats')
const OLD_STATS = path.join(dataFolder, 'stats')
const SEASON_PLAYER = 'season-player'
const OLD_PLAYER = 'old-player'
const NEW_PLAYER = 'new-player'

function writeStats(folder, key) {
   fs.mkdirSync(folder, { recursive: true })
   fs.writeFileSync(path.join(folder, key), JSON.stringify({ key, name: key, history: [] }))
}

describe('per-season stats folder', () => {
   let stats

   before(() => {
      assert.equal(fs.existsSync(SEASON_STATS), false)
      stats = require('../model/stats')
   })

   after(() => fixture.cleanup())

   it('creates the season stats folder when it is missing', () => {
      assert.equal(fs.existsSync(SEASON_STATS), true)
   })

   it('saves stats in the season folder', () => {
      stats.set(NEW_PLAYER, { key: NEW_PLAYER, name: 'New Player', history: [] })

      assert.equal(fs.existsSync(path.join(SEASON_STATS, NEW_PLAYER)), true)
      assert.equal(fs.existsSync(path.join(OLD_STATS, NEW_PLAYER)), false)
   })

   it('loads stats from the season folder and not the old shared folder', () => {
      writeStats(SEASON_STATS, SEASON_PLAYER)
      writeStats(OLD_STATS, OLD_PLAYER)

      const keys = stats.all().map(s => s.key)

      assert.ok(keys.includes(SEASON_PLAYER))
      assert.ok(!keys.includes(OLD_PLAYER))
   })
})
