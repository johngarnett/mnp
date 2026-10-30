/*
   Shared data for the browser tests: one finished match in the format in
   use, with the admin logged in under a known session ID.
*/
const fixture = require('./fixture')
const { rosterFor } = require('./simulate-match')

const AWAY_KEY = 'E2A'
const HOME_KEY = 'E2H'
const SESSION_ID = 'pages-admin'
// lib/formats reads only MATCH_FORMAT, so it is safe before fixture.setup();
// lib/branding reads config (DATA_FOLDER), so it is loaded in matchKey().
const format = require('../../lib/formats')
const size = format.lineup.max

function matchKey() {
   return `${require('../../lib/branding').matchKeyPrefix}-1-1-${AWAY_KEY}-${HOME_KEY}`
}

const options = {
   ratings: [...rosterFor(AWAY_KEY, size), ...rosterFor(HOME_KEY, size)]
}

// Must be called after fixture.setup(), since it loads app modules.
function seed() {
   const { simulate } = require('./simulate-match')

   simulate({ key: matchKey(), shape: format.rounds, awaySize: size, homeSize: size, awayKey: AWAY_KEY, homeKey: HOME_KEY })
   require('../../model/matches').get(matchKey())
   fixture.login(fixture.ADMIN_KEY, SESSION_ID)
}

module.exports = { options, seed, matchKey, SESSION_ID }
