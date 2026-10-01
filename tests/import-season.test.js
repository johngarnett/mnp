/*
   importers/import-season.js (mnp's importer, adapted for NESLP) builds
   <season>/season.json from mnp-format CSV files. NESLP changes: match keys are
   slp-<number>-<week>-<venue>-<home>-<away>, the number comes from --number or the
   folder name, groups.csv is optional, BYE is allowed, special events no longer
   crash, and unknown keys are listed instead of crashing or being skipped.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const NUM_WEEKS = '2'
const FOLDER = '7'

const FILES = {
   'venues.csv': ['BAR,The Bar', 'PUB,The Pub'],
   'teams.csv': ['RED,BAR,Red Team,1', 'BLU,PUB,Blue Team,1', 'GRN,BAR,Green Team,1'],
   'rosters.csv': ['Ann Able ,RED,C', 'Bo Baker,RED,A', 'Cy Cole,RED,P', 'Di Dunn,BLU,C', 'Ed Ely,GRN,P'],
   // Out of date order; weeks must come out sorted by date.
   'matches.csv': [
      '1,20260910,BLU,RED,BAR',
      'S,20260903,BLU,RED,BAR',
      '0,20260905,RED,<b>Kickoff party</b>,',
      '2,20260917,GRN,BLU,PUB',
      '2,20260917,BYE,RED,BAR',
      '3,20261001,S2,S1,PUB'
   ]
}

function writeInputs(folder, files) {
   const dir = path.join(dataFolder, folder)

   fs.mkdirSync(dir, { recursive: true })
   for (const [name, lines] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n')
   }
   return dir
}

function runImport(...args) {
   return spawnSync(process.execPath, ['importers/import-season.js', ...args], {
      env: { ...process.env, NUM_WEEKS },
      encoding: 'utf8'
   })
}

after(() => fixture.cleanup())

function readSeason(folder) {
   return JSON.parse(fs.readFileSync(path.join(dataFolder, folder, 'season.json'), 'utf8'))
}

describe('importers/import-season.js', () => {
   let season

   before(() => {
      writeInputs(FOLDER, FILES)
      const result = runImport(FOLDER)
      assert.equal(result.status, 0, result.stderr)
      season = readSeason(FOLDER)
   })

   it('makes slp-<number>-<week>-<venue>-<home>-<away> keys, numbered from the folder', () => {
      const week1 = season.weeks.find(w => w.n === '1')

      assert.equal(season.key, FOLDER)
      assert.equal(week1.matches[0].match_key, `slp-${FOLDER}-1-BAR-RED-BLU`)
      assert.equal(week1.matches[0].home_key, 'RED')
      assert.equal(week1.matches[0].away_key, 'BLU')
      assert.deepEqual(week1.matches[0].venue, { key: 'BAR', name: 'The Bar' })
   })

   it('uses --number for the season number in match keys', () => {
      const result = runImport(FOLDER, '--number', '1')

      assert.equal(result.status, 0, result.stderr)
      assert.equal(readSeason(FOLDER).weeks.find(w => w.n === '1').matches[0].match_key, 'slp-1-1-BAR-RED-BLU')
      runImport(FOLDER)
   })

   it('builds rosters with trimmed names, captains, and co-captains', () => {
      assert.deepEqual(season.teams.RED.roster, [{ name: 'Ann Able' }, { name: 'Bo Baker' }, { name: 'Cy Cole' }])
      assert.equal(season.teams.RED.captain, 'Ann Able')
      assert.equal(season.teams.RED.co_captain, 'Bo Baker')
      assert.equal(season.teams.RED.division, 0)
   })

   it("adds each match to both teams' schedules", () => {
      const entry = season.teams.BLU.schedule.find(s => s.week === '1')

      assert.deepEqual(entry, {
         match_key: `slp-${FOLDER}-1-BAR-RED-BLU`,
         week: '1',
         date: '20260910',
         side: '@',
         opp: { key: 'RED', name: 'Red Team' }
      })
   })

   it('lists weeks in date order with MM/DD/YYYY dates', () => {
      assert.deepEqual(season.weeks.map(w => [w.n, w.date]), [
         ['S', '09/03/2026'],
         [undefined, '09/05/2026'],
         ['1', '09/10/2026'],
         ['2', '09/17/2026'],
         ['3', '10/01/2026']
      ])
   })

   it('marks a scrimmage week as special', () => {
      const scrimmage = season.weeks.find(w => w.n === 'S')

      assert.equal(scrimmage.code, 'SCRM')
      assert.equal(scrimmage.isSpecial, true)
   })

   it("shows a special event at its host team's venue", () => {
      const event = season.weeks.find(w => w.date === '09/05/2026')

      assert.deepEqual(event, {
         date: '09/05/2026',
         isSpecial: true,
         html: '<b>Kickoff party</b>',
         venue: { key: 'BAR', name: 'The Bar' }
      })
   })

   it('marks weeks after NUM_WEEKS as playoffs with unlinked placeholder teams', () => {
      const playoffs = season.weeks.find(w => w.n === '3')
      const [match] = playoffs.matches

      assert.equal(playoffs.isPlayoffs, true)
      assert.equal(season.weeks.find(w => w.n === '2').isPlayoffs, false)
      assert.equal(match.home_name, 'Seed #1')
      assert.equal(match.home_linked, false)
      assert.equal(match.away_linked, false)
      assert.equal(season.teams.S1, undefined)
   })

   it('shows a BYE unlinked and gives it no team entry', () => {
      const bye = season.weeks.find(w => w.n === '2').matches.find(m => m.away_key === 'BYE')

      assert.equal(bye.away_name, 'BYE')
      assert.equal(bye.away_linked, false)
      assert.equal(bye.home_linked, true)
      assert.equal(season.teams.BYE, undefined)
      assert.ok(season.teams.RED.schedule.some(s => s.opp.key === 'BYE'))
   })

   it('puts every team in the target group when there is no groups.csv', () => {
      assert.deepEqual(season.groups, { target: { key: 'target', name: 'Target', teams: ['RED', 'BLU', 'GRN'] } })
   })

   it('uses groups.csv when present', () => {
      writeInputs(FOLDER, { 'groups.csv': ['main,North End,RED,BLU,GRN,'] })
      const result = runImport(FOLDER)
      fs.rmSync(path.join(dataFolder, FOLDER, 'groups.csv'))

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(readSeason(FOLDER).groups, { main: { key: 'main', name: 'North End', teams: ['RED', 'BLU', 'GRN'] } })
   })
})

describe('importers/import-season.js problems', () => {
   it('lists every unknown key and leaves season.json unchanged', () => {
      const folder = '8'
      const dir = writeInputs(folder, {
         ...FILES,
         'teams.csv': [...FILES['teams.csv'], 'ORG,NOPE,Orange Team,1'],
         'rosters.csv': [...FILES['rosters.csv'], 'Fay Ford,XXX,P'],
         'matches.csv': [
            ...FILES['matches.csv'],
            '1,20260910,ZZZ,RED,BAR',
            '1,20260910,BLU,RED,NOWHERE',
            '1,2026-09-10,BLU,RED,BAR',
            '2,20260917,S1,RED,BAR',
            '2,20260917,BYE,BYE,BAR'
         ],
         'groups.csv': ['main,Main,RED,QQQ']
      })
      const before = 'previous season.json'
      fs.writeFileSync(path.join(dir, 'season.json'), before)

      const result = runImport(folder)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /teams\.csv row 4: team ORG has unknown venue "NOPE"/)
      assert.match(result.stderr, /rosters\.csv row 6: unknown team "XXX" for Fay Ford/)
      assert.match(result.stderr, /matches\.csv row 7: unknown team "ZZZ"/)
      assert.match(result.stderr, /matches\.csv row 8: unknown venue "NOWHERE"/)
      assert.match(result.stderr, /matches\.csv row 9: date "2026-09-10" is not YYYYMMDD/)
      assert.match(result.stderr, /matches\.csv row 10: unknown team "S1"/)
      assert.match(result.stderr, /matches\.csv row 11: both teams are BYE/)
      assert.match(result.stderr, /groups\.csv row 1: unknown team "QQQ"/)
      assert.equal(fs.readFileSync(path.join(dir, 'season.json'), 'utf8'), before)
   })

   it('reports missing input files', () => {
      const folder = '9'
      writeInputs(folder, { 'venues.csv': FILES['venues.csv'] })

      const result = runImport(folder)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Missing in .*: teams\.csv, rosters\.csv, matches\.csv/)
   })

   it('asks for --number when the folder name is not a season number', () => {
      writeInputs('spring', FILES)

      const result = runImport('spring')

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Cannot tell the season number for "spring"\. Pass --number\./)
   })
})
