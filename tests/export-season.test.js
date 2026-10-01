/*
   Adapted from mnp bcf0c95: importers/export-season.js writes current rosters to
   <season>/exported-players.csv in the players.csv format importers/genseason.js
   reads, so it can seed next season. NESLP fixes: a season argument selects which
   season is read, and a missing season is reported instead of crashing.
*/
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const OTHER_SEASON = 'season-other'
const OUTPUT_FILE = 'exported-players.csv'
const HEADER = 'team\tname\tcaptain\tco-captain'

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

// The header line, then the data rows sorted.
function readExport(season) {
   const [header, ...rows] = fs.readFileSync(path.join(dataFolder, season, OUTPUT_FILE), 'utf8').trim().split('\n')

   assert.equal(header, HEADER)
   return rows.sort()
}

describe('importers/export-season.js', () => {
   after(() => fixture.cleanup())

   it('exports the current season rosters with captain and co-captain flags', () => {
      const result = runExport()

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(readExport(fixture.TEST_SEASON), [
         'BLU\tDi Dunn\tFALSE\tFALSE',
         'BLU\tEd Ely\tTRUE\tFALSE',
         'RED\tAnn Able\tFALSE\tFALSE',
         'RED\tBo Baker\tTRUE\tFALSE',
         'RED\tCy Cole\tFALSE\tTRUE'
      ])
   })

   it('reads and writes the season given as an argument', () => {
      const result = runExport(OTHER_SEASON)

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(readExport(OTHER_SEASON), ['GRN\tFay Ford\tTRUE\tFALSE', 'GRN\tGus Gray\tFALSE\tFALSE'])
   })

   it('round-trips through importers/genseason.js as players.csv', () => {
      const { parseTsv, buildSeason } = require('../importers/genseason')
      const exported = fs.readFileSync(path.join(dataFolder, fixture.TEST_SEASON, OUTPUT_FILE), 'utf8')
      const { season } = buildSeason('1', {
         venues: { BAR: { key: 'BAR', name: 'The Bar' } },
         weeks: {},
         teams: { RED: { key: 'RED', name: 'RED Team', venue: 'BAR' }, BLU: { key: 'BLU', name: 'BLU Team', venue: 'BAR' } },
         players: parseTsv(exported),
         schedule: []
      })

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
