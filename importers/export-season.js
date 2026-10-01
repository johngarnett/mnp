/*
   Writes each team's current roster to <DATA_FOLDER>/<season>/exported-players.csv
   in the players.csv format read by importers/genseason.js (tab-separated):
      team, name, captain (TRUE/FALSE), co-captain (TRUE/FALSE)
   Rosters change during a season (on the team pages), so this captures them as a
   starting point for the next season's players.csv.

   Usage: node importers/export-season.js [season]   (default: CURRENT_SEASON)

   Adapted from mnp bcf0c95, which wrote mnp's rosters.csv format.
*/
const fs = require('fs')
const path = require('path')

// Set before the models load, since they read CURRENT_SEASON once.
if (process.argv[2]) {
   process.env.CURRENT_SEASON = process.argv[2]
}

const config = require('../config')
const seasons = require('../model/seasons')

const OUTPUT_FILE = 'exported-players.csv'
const HEADER = ['team', 'name', 'captain', 'co-captain']

function flag(value) {
   return value ? 'TRUE' : 'FALSE'
}

function sameName(a, b) {
   return !!a && !!b && a.trim() === b.trim()
}

function rosterRows(season) {
   return Object.entries(season.teams).flatMap(([teamKey, team]) =>
      (team.roster || []).map(player => [
         teamKey,
         player.name.trim(),
         flag(sameName(player.name, team.captain)),
         flag(sameName(player.name, team.co_captain))
      ].join('\t'))
   )
}

const season = seasons.get()

if (!season) {
   console.error(`No season.json found for season "${config.CURRENT_SEASON}" in ${config.DATA_FOLDER}`)
   process.exit(1)
}

const outputPath = path.join(config.DATA_FOLDER, config.CURRENT_SEASON, OUTPUT_FILE)
const rows = rosterRows(season)

fs.writeFileSync(outputPath, [HEADER.join('\t'), ...rows].map(row => row + '\n').join(''))
console.log(`Wrote ${rows.length} players to ${outputPath}`)
