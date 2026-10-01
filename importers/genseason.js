/*
   Builds season.json from tab-separated files that have a header row:

      venues.csv     key, name, ...
      weeks.csv      key (week number), date (MM/DD/YYYY)
      teams.csv      key, name, venue, group (optional), division
      players.csv    team, name, captain (TRUE/FALSE), co-captain (TRUE/FALSE)
      schedule.csv   week, venue, home, away, playoffs (TRUE/FALSE)
      groups.csv     key, name   (optional; otherwise a group's name is its key
                                  with the first letter capitalized)

   Every team must be in a group (the team page needs one). Teams without a group
   go in the "target" group.

   Match keys are slp-<season>-<week>-<venue>-<home>-<away>. Use BYE as the home or
   away team for a bye; spawn-matches skips those matches.

   Usage: node importers/genseason.js <season number> [--input <dir>] [--output <file>]
      --input   folder with the files above (default: current folder)
      --output  file to write (default: print to the console)

   Problems such as unknown team, venue, or week keys are all listed, and nothing
   is written.

   Based on tools/genseason.js.
*/
const fs = require('fs')
const path = require('path')

const BYE = 'BYE'
const DEFAULT_GROUP = 'target'
const TRUE_VALUE = 'TRUE'
const JSON_INDENT = 3
const INPUT_FILES = ['venues', 'weeks', 'teams', 'players', 'schedule']

// Rows of a tab-separated file as objects keyed by the header row.
function parseTsv(text) {
   const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
   const header = (lines.shift() || '').split('\t').map(h => h.trim())

   return lines.map(line => {
      const cells = line.split('\t')

      return Object.fromEntries(header.map((name, i) => [name, (cells[i] || '').trim()]))
   })
}

function keyBy(rows) {
   return Object.fromEntries(rows.map(row => [row.key, row]))
}

function capitalize(text) {
   return text.charAt(0).toUpperCase() + text.slice(1)
}

function makeMatchKey(season, week, venue, home, away) {
   return ['slp', season, week, venue, home, away].join('-')
}

// MM/DD/YYYY -> YYYYMMDD, the date format of team schedule entries.
function noSlashDate(date) {
   const [month, day, year] = date.split('/')

   return year + month + day
}

function makeTeams(teams) {
   return Object.fromEntries(Object.values(teams).map(t => [t.key, {
      key: t.key,
      venue: t.venue,
      name: t.name,
      division: t.division,
      roster: [],
      schedule: []
   }]))
}

function makeGroups(teams, groupNames) {
   const groups = {}

   for (const team of Object.values(teams)) {
      const key = team.group || DEFAULT_GROUP
      const group = groups[key] || {
         key,
         name: groupNames[key] ? groupNames[key].name : capitalize(key),
         teams: []
      }
      group.teams.push(team.key)
      groups[key] = group
   }
   return groups
}

function checkInputs({ venues, weeks, teams, players, schedule }) {
   const errors = []
   const isTeam = key => key === BYE || !!teams[key]

   for (const team of Object.values(teams)) {
      if (!venues[team.venue]) errors.push(`teams.csv: team ${team.key} has unknown venue "${team.venue}"`)
   }
   players.forEach((p, i) => {
      if (!teams[p.team]) errors.push(`players.csv row ${i + 2}: unknown team "${p.team}" for ${p.name}`)
   })
   schedule.forEach((m, i) => {
      const row = `schedule.csv row ${i + 2}`

      if (!weeks[m.week]) errors.push(`${row}: unknown week "${m.week}"`)
      if (!venues[m.venue]) errors.push(`${row}: unknown venue "${m.venue}"`)
      if (!isTeam(m.home)) errors.push(`${row}: unknown home team "${m.home}"`)
      if (!isTeam(m.away)) errors.push(`${row}: unknown away team "${m.away}"`)
      if (m.home === BYE && m.away === BYE) errors.push(`${row}: both teams are ${BYE}`)
   })
   return errors
}

function teamName(teams, key) {
   return key === BYE ? BYE : teams[key].name
}

// Returns { season } or { errors } when the inputs reference unknown keys.
function buildSeason(seasonNumber, inputs) {
   const { venues, weeks, teams, players, schedule, groups = {} } = inputs
   const errors = checkInputs(inputs)
   if (errors.length > 0) return { errors }

   const result = {
      key: 'season-' + seasonNumber,
      groups: makeGroups(teams, groups),
      teams: makeTeams(teams),
      weeks: []
   }

   for (const p of players) {
      const team = result.teams[p.team]

      if (p.captain === TRUE_VALUE) {
         team.captain = p.name
      } else if (p['co-captain'] === TRUE_VALUE) {
         team.co_captain = p.name
      }
      team.roster.push({ name: p.name })
   }

   const weeksByNumber = {}

   for (const m of schedule) {
      const matchKey = makeMatchKey(seasonNumber, m.week, m.venue, m.home, m.away)
      const date = weeks[m.week].date
      const addToSchedule = (teamKey, side, oppKey) => {
         if (teamKey === BYE) return
         result.teams[teamKey].schedule.push({
            match_key: matchKey,
            week: m.week,
            date: noSlashDate(date),
            side,
            opp: { key: oppKey, name: teamName(teams, oppKey) }
         })
      }

      addToSchedule(m.home, 'vs', m.away)
      addToSchedule(m.away, '@', m.home)

      if (!weeksByNumber[m.week]) {
         weeksByNumber[m.week] = {
            n: m.week,
            label: 'WEEK ' + m.week,
            code: 'WK' + m.week,
            isPlayoffs: m.playoffs === TRUE_VALUE,
            date,
            matches: []
         }
      }
      weeksByNumber[m.week].matches.push({
         match_key: matchKey,
         away_key: m.away,
         away_name: teamName(teams, m.away),
         home_key: m.home,
         home_name: teamName(teams, m.home),
         away_linked: m.away !== BYE,
         home_linked: m.home !== BYE,
         venue: { key: m.venue, name: venues[m.venue].name }
      })
   }

   result.weeks = Object.values(weeksByNumber).sort((a, b) => Number(a.n) - Number(b.n))
   return { season: result }
}

// JSON with each group's team list on one line, e.g. "teams": ["DOOM", "PIZZA"].
function formatSeason(season) {
   return JSON.stringify(season, null, JSON_INDENT)
      .replace(/("teams": )\[([^\]{}]*)\]/g, (match, label, list) =>
         label + '[' + list.trim().split(/,\s*/).join(', ') + ']') + '\n'
}

function readInputs(dir) {
   const read = name => parseTsv(fs.readFileSync(path.join(dir, name + '.csv'), 'utf8'))
   const optional = name => fs.existsSync(path.join(dir, name + '.csv')) ? read(name) : []

   return {
      venues: keyBy(read('venues')),
      weeks: keyBy(read('weeks')),
      teams: keyBy(read('teams')),
      players: read('players'),
      schedule: read('schedule'),
      groups: keyBy(optional('groups'))
   }
}

function parseArgs(argv) {
   const args = { input: '.', output: null, season: null }

   for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--input') args.input = argv[++i]
      else if (argv[i] === '--output') args.output = argv[++i]
      else args.season = argv[i]
   }
   return args
}

function main() {
   const args = parseArgs(process.argv.slice(2))

   if (!args.season || !/^\d+$/.test(args.season)) {
      console.error('Usage: node importers/genseason.js <season number> [--input <dir>] [--output <file>]')
      process.exit(1)
   }

   const missing = INPUT_FILES.filter(name => !fs.existsSync(path.join(args.input, name + '.csv')))
   if (missing.length > 0) {
      console.error(`Missing input files in ${path.resolve(args.input)}: ${missing.map(n => n + '.csv').join(', ')}`)
      process.exit(1)
   }

   const { season, errors } = buildSeason(args.season, readInputs(args.input))
   if (errors) {
      console.error(errors.join('\n'))
      process.exit(1)
   }

   const json = formatSeason(season)
   if (args.output) {
      fs.writeFileSync(args.output, json)
      console.error(`Wrote ${args.output}`)
   } else {
      process.stdout.write(json)
   }
}

if (require.main === module) {
   main()
}

module.exports = { parseTsv, buildSeason, makeMatchKey, formatSeason }
