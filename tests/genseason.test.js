/*
   importers/genseason.js (from tools/genseason.js) builds season.json from
   tab-separated files. NESLP additions over the original: season number argument,
   groups from teams.csv, BYE matches, listing every unknown key, --output, and
   trimmed values.
*/
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SEASON = '3'
const T = '\t'

const FILES = {
   'venues.csv': ['key\tname\taddress', 'BAR\tThe Bar\t1 Main St', 'PUB\tThe Pub\t2 Main St'],
   'weeks.csv': ['key\tdate', '1\t09/10/2026', '2\t09/17/2026', '10\t11/12/2026'],
   'teams.csv': [
      'key\tname\tvenue\tgroup\tdivision',
      'RED\tRed Team\tBAR\tmain\t1',
      'BLU\tBlue Team\tPUB\tmain\t1',
      'GRN\tGreen Team\tBAR\tmain\t2'
   ],
   'players.csv': [
      'team\tname\tcaptain\tco-captain',
      'RED\tAnn Able \tTRUE\tFALSE',
      'RED\tBo Baker\tFALSE\tTRUE',
      'BLU\tCy Cole\tTRUE\tFALSE',
      'GRN\tDi Dunn\tFALSE\tFALSE'
   ],
   // Out of week order, to check weeks come out sorted (10 after 2).
   'schedule.csv': [
      'week\tvenue\thome\taway\tplayoffs',
      '10\tPUB\tBLU\tRED\tTRUE',
      '1\tBAR\tRED\tBLU\tFALSE',
      '2\tBAR\tGRN\tRED\tFALSE',
      '2\tPUB\tBYE\tBLU\tFALSE'
   ]
}

function writeInputs(dir, files) {
   for (const [name, lines] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n')
   }
}

function run(...args) {
   return spawnSync(process.execPath, ['importers/genseason.js', ...args], { encoding: 'utf8' })
}

describe('importers/genseason.js', () => {
   let dir
   let season

   before(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neslp-test-genseason-'))
      writeInputs(dir, FILES)
      const result = run(SEASON, '--input', dir)
      assert.equal(result.status, 0, result.stderr)
      season = JSON.parse(result.stdout)
   })

   after(() => fs.rmSync(dir, { recursive: true, force: true }))

   it('names the season and builds groups from teams.csv', () => {
      assert.equal(season.key, `season-${SEASON}`)
      assert.deepEqual(season.groups, { main: { key: 'main', name: 'Main', teams: ['RED', 'BLU', 'GRN'] } })
   })

   it('builds teams with trimmed roster names, captains, and divisions', () => {
      assert.deepEqual(season.teams.RED.roster, [{ name: 'Ann Able' }, { name: 'Bo Baker' }])
      assert.equal(season.teams.RED.captain, 'Ann Able')
      assert.equal(season.teams.RED.co_captain, 'Bo Baker')
      assert.equal(season.teams.GRN.division, '2')
      assert.equal(season.teams.BLU.venue, 'PUB')
   })

   it('makes match keys as slp-<season>-<week>-<venue>-<home>-<away>', () => {
      const [match] = season.weeks[0].matches

      assert.equal(match.match_key, `slp-${SEASON}-1-BAR-RED-BLU`)
      assert.equal(match.home_key, 'RED')
      assert.equal(match.away_key, 'BLU')
      assert.deepEqual(match.venue, { key: 'BAR', name: 'The Bar' })
   })

   it('lists weeks in number order with labels, dates, and playoff flags', () => {
      assert.deepEqual(season.weeks.map(w => [w.n, w.label, w.code, w.date, w.isPlayoffs]), [
         ['1', 'WEEK 1', 'WK1', '09/10/2026', false],
         ['2', 'WEEK 2', 'WK2', '09/17/2026', false],
         ['10', 'WEEK 10', 'WK10', '11/12/2026', true]
      ])
   })

   it("adds each match to both teams' schedules", () => {
      assert.deepEqual(season.teams.RED.schedule[0], {
         match_key: `slp-${SEASON}-10-PUB-BLU-RED`,
         week: '10',
         date: '20261112',
         side: '@',
         opp: { key: 'BLU', name: 'Blue Team' }
      })
      assert.equal(season.teams.BLU.schedule[0].side, 'vs')
   })

   it('shows a BYE unlinked and gives it no schedule entries', () => {
      const bye = season.weeks[1].matches.find(m => m.home_key === 'BYE')

      assert.equal(bye.home_name, 'BYE')
      assert.equal(bye.home_linked, false)
      assert.equal(bye.away_linked, true)
      assert.equal(season.teams.BYE, undefined)
      assert.ok(season.teams.BLU.schedule.some(s => s.opp.key === 'BYE'))
   })

   it('uses group names from an optional groups.csv', () => {
      fs.writeFileSync(path.join(dir, 'groups.csv'), 'key\tname\nmain\tNorth End\n')
      const result = run(SEASON, '--input', dir)
      fs.rmSync(path.join(dir, 'groups.csv'))

      assert.equal(JSON.parse(result.stdout).groups.main.name, 'North End')
   })

   it('puts each group\'s team list on one line', () => {
      const result = run(SEASON, '--input', dir)

      assert.match(result.stdout, /\n {9}"teams": \["RED", "BLU", "GRN"\]\n/)
   })

   it('puts teams without a group in the target group', () => {
      const { buildSeason } = require('../importers/genseason')
      const { season } = buildSeason(SEASON, {
         venues: { BAR: { key: 'BAR', name: 'The Bar' } },
         weeks: {},
         teams: { RED: { key: 'RED', name: 'Red', venue: 'BAR', group: '' }, BLU: { key: 'BLU', name: 'Blue', venue: 'BAR' } },
         players: [],
         schedule: []
      })

      assert.deepEqual(season.groups, { target: { key: 'target', name: 'Target', teams: ['RED', 'BLU'] } })
   })

   it('writes the file given with --output', () => {
      const output = path.join(dir, 'season.json')
      const result = run(SEASON, '--input', dir, '--output', output)

      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), season)
   })
})

describe('importers/genseason.js problems', () => {
   let dir

   before(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neslp-test-genseason-bad-'))
   })

   after(() => fs.rmSync(dir, { recursive: true, force: true }))

   it('lists every unknown key and writes nothing', () => {
      const output = path.join(dir, 'season.json')
      writeInputs(dir, {
         ...FILES,
         'teams.csv': [...FILES['teams.csv'], `ORG${T}Orange${T}NOPE${T}main${T}1`],
         'players.csv': [...FILES['players.csv'], `XXX${T}Ed Ely${T}FALSE${T}FALSE`],
         'schedule.csv': [...FILES['schedule.csv'], `7${T}PUB${T}RED${T}ZZZ${T}FALSE`, `1${T}BAR${T}BYE${T}BYE${T}FALSE`]
      })

      const result = run(SEASON, '--input', dir, '--output', output)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /team ORG has unknown venue "NOPE"/)
      assert.match(result.stderr, /players\.csv row 6: unknown team "XXX"/)
      assert.match(result.stderr, /schedule\.csv row 6: unknown week "7"/)
      assert.match(result.stderr, /schedule\.csv row 6: unknown away team "ZZZ"/)
      assert.match(result.stderr, /schedule\.csv row 7: both teams are BYE/)
      assert.equal(fs.existsSync(output), false)
   })

   it('reports missing input files', () => {
      const empty = fs.mkdtempSync(path.join(dir, 'empty-'))
      const result = run(SEASON, '--input', empty)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Missing input files .*venues\.csv, weeks\.csv, teams\.csv, players\.csv, schedule\.csv/)
   })

   it('requires a season number', () => {
      const result = run('--input', dir)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Usage: node importers\/genseason\.js <season number>/)
   })
})
