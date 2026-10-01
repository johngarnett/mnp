/*
   Shared data for the substitute name tests: a pregame match whose away team roster
   includes a single-name player (taken off the lineup so the captain can add them
   back), plus a registered player with a legacy single name. The admin has a known
   session ID so browser tests can log in.
*/
const fixture = require('./fixture')

const MATCH_KEY = 'slp-test-4-SUBA-SUBH'
const AWAY_KEY = 'SUBA'
const HOME_KEY = 'SUBH'
const SESSION_ID = 'sub-names-admin'
const ROSTER_NAME = 'Rostered Player'
const SINGLE_NAME_ROSTER_PLAYER = 'Mittens'
const LEGACY_PLAYER_NAME = 'Legacy'

function makeTeam(key, roster) {
   return { key, name: `${key} Team`, venue: fixture.VENUE_KEY, roster: roster.map(name => ({ name })), schedule: [] }
}

const options = {
   season: {
      teams: {
         [AWAY_KEY]: makeTeam(AWAY_KEY, [ROSTER_NAME, SINGLE_NAME_ROSTER_PLAYER]),
         [HOME_KEY]: makeTeam(HOME_KEY, ['Home Player'])
      },
      groups: { subs: { key: 'subs', name: 'Subs', teams: [AWAY_KEY, HOME_KEY] } }
   }
}

// Must be called after fixture.setup(), since it loads app modules.
function seed() {
   const CONST = require('../../constants')
   const matches = require('../../model/matches')
   const players = require('../../model/players')
   const season = require('../../model/seasons').get()
   const match = new matches.Match({
      key: MATCH_KEY,
      state: CONST.PREGAME,
      venue: fixture.VENUE_KEY,
      away: season.teams[AWAY_KEY],
      home: season.teams[HOME_KEY]
   })

   match.away.lineup = match.away.lineup.filter(p => p.name !== SINGLE_NAME_ROSTER_PLAYER)
   match.save()
   fixture.createPlayer({ key: players.makeKey(LEGACY_PLAYER_NAME), name: LEGACY_PLAYER_NAME })
   fixture.login(fixture.ADMIN_KEY, SESSION_ID)
}

module.exports = {
   MATCH_KEY,
   SESSION_ID,
   SINGLE_NAME_ROSTER_PLAYER,
   LEGACY_PLAYER_NAME,
   options,
   seed
}
