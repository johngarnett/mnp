/*
   Writes each team's current roster to <DATA_FOLDER>/<season>/exported-rosters.csv
   in the rosters.csv format read by import-season.js:
      name,team key,role   (role: C captain, A co-captain, P player)
   Rosters change during a season, so this captures them as a starting point for
   the next season's rosters.csv.

   Usage: node importers/export-season.js [season]   (default: CURRENT_SEASON)

   Adapted from mnp bcf0c95.
*/
const fs = require('fs')
const path = require('path')

// Set before the models load, since they read CURRENT_SEASON once.
if (process.argv[2]) {
   process.env.CURRENT_SEASON = process.argv[2]
}

const config = require('../config')
const seasons = require('../model/seasons')

const OUTPUT_FILE = 'exported-rosters.csv'
const CAPTAIN = 'C'
const CO_CAPTAIN = 'A'
const PLAYER = 'P'

function roleFor(team, name) {
   if (name === team.captain) return CAPTAIN
   if (name === team.co_captain) return CO_CAPTAIN
   return PLAYER
}

function rosterRows(season) {
   return Object.entries(season.teams).flatMap(([teamKey, team]) =>
      (team.roster || []).map(player => [player.name, teamKey, roleFor(team, player.name)].join(','))
   )
}

const season = seasons.get()

if (!season) {
   console.error(`No season.json found for season "${config.CURRENT_SEASON}" in ${config.DATA_FOLDER}`)
   process.exit(1)
}

const outputPath = path.join(config.DATA_FOLDER, config.CURRENT_SEASON, OUTPUT_FILE)
const rows = rosterRows(season)

fs.writeFileSync(outputPath, rows.map(row => row + '\n').join(''))
console.log(`Wrote ${rows.length} players to ${outputPath}`)
