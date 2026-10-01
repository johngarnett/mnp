/*
   Adapted from mnp bcf0c95: importers/export-season.js writes current rosters to
   <season>/exported-rosters.csv in the rosters.csv format (name,team,role) that
   importers/import-season.js reads, so it can seed next season. NESLP fixes: a
   season argument selects which season is read, and a missing season is reported
   instead of crashing.
*/
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const OTHER_SEASON = 'season-other'
const OUTPUT_FILE = 'exported-rosters.csv'

function makeTeam(key, roster, captain, coCaptain) {
   return { key, name: `${key} Team`, roster: roster.map(name => ({ name })), captain, co_captain: coCaptain }
}

const dataFolder = fixture.setup({
   season: {
      teams: {
         RED: makeTeam('RED', ['Ann Able', 'Bo Baker', 'Cy Cole'], 'Bo Baker', 'Cy Cole'),
         BLU: makeTeam('BLU', ['Di Dunn', 'Ed Ely'], 'Ed Ely')
      }
   }
})

fs.mkdirSync(path.join(dataFolder, OTHER_SEASON))
fs.writeFileSync(path.join(dataFolder, OTHER_SEASON, 'season.json'), JSON.stringify({
   key: OTHER_SEASON,
   teams: { GRN: makeTeam('GRN', ['Fay Ford', 'Gus Gray'], 'Fay Ford') }
}))

function runExport(...args) {
   return spawnSync(process.execPath, ['importers/export-season.js', ...args], {
      env: process.env,
      encoding: 'utf8'
   })
}

function readExport(season) {
   return fs.readFileSync(path.join(dataFolder, season, OUTPUT_FILE), 'utf8').trim().split('\n').sort()
}

describe('importers/export-season.js', () => {
   after(() => fixture.cleanup())

   it('exports the current season rosters with captain and co-captain roles', () => {
      const result = runExport()

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(readExport(fixture.TEST_SEASON), [
         'Ann Able,RED,P',
         'Bo Baker,RED,C',
         'Cy Cole,RED,A',
         'Di Dunn,BLU,P',
         'Ed Ely,BLU,C'
      ])
   })

   it('reads and writes the season given as an argument', () => {
      const result = runExport(OTHER_SEASON)

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(readExport(OTHER_SEASON), ['Fay Ford,GRN,C', 'Gus Gray,GRN,P'])
   })

   it('round-trips through importers/import-season.js as rosters.csv', () => {
      const folder = '5'
      const dir = path.join(dataFolder, folder)
      fs.mkdirSync(dir)
      fs.copyFileSync(path.join(dataFolder, fixture.TEST_SEASON, OUTPUT_FILE), path.join(dir, 'rosters.csv'))
      fs.writeFileSync(path.join(dir, 'venues.csv'), 'BAR,The Bar\n')
      fs.writeFileSync(path.join(dir, 'teams.csv'), 'RED,BAR,Red Team\nBLU,BAR,Blue Team\n')
      fs.writeFileSync(path.join(dir, 'matches.csv'), '')

      const result = spawnSync(process.execPath, ['importers/import-season.js', folder], { env: process.env, encoding: 'utf8' })
      const season = JSON.parse(fs.readFileSync(path.join(dir, 'season.json'), 'utf8'))

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(season.teams.RED.roster.map(p => p.name), ['Ann Able', 'Bo Baker', 'Cy Cole'])
      assert.equal(season.teams.RED.captain, 'Bo Baker')
      assert.equal(season.teams.RED.co_captain, 'Cy Cole')
      assert.equal(season.teams.BLU.captain, 'Ed Ely')
   })

   it('reports a missing season instead of crashing', () => {
      const result = runExport('season-missing')

      assert.equal(result.status, 1)
      assert.match(result.stderr, /No season\.json found for season "season-missing"/)
   })
})
