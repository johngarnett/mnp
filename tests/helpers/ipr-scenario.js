/*
   Shared data for the unknown-IPR display tests: two teams, each with one rated
   and one unrated player, playing a pregame match.
*/
const fixture = require('./fixture')

const RATED_NAME = 'Rated Player'
const RATED_IPR = 3
const UNRATED_NAME = 'Unrated Player'
const UNRATED_IPR = 1
const TEAM_IPR = RATED_IPR + UNRATED_IPR
const ROSTER_SIZE = 2
const TEAM_KEY = 'AWAY'
const OPPONENT_KEY = 'HOME'
const MATCH_KEY = 'slp-test-1-AWAY-HOME'

function makeTeam(key) {
   return {
      key,
      name: `${key} Team`,
      venue: fixture.VENUE_KEY,
      roster: [{ name: RATED_NAME }, { name: UNRATED_NAME }],
      schedule: []
   }
}

function setup() {
   fixture.setup({
      ratings: [{ name: RATED_NAME, ipr: RATED_IPR }],
      season: {
         teams: { [TEAM_KEY]: makeTeam(TEAM_KEY), [OPPONENT_KEY]: makeTeam(OPPONENT_KEY) },
         groups: { test: { key: 'test', name: 'Test', teams: [TEAM_KEY, OPPONENT_KEY] } }
      }
   })
}

// Must be called after setup(), since it loads app modules.
function createPregameMatch() {
   const CONST = require('../../constants')
   const matches = require('../../model/matches')
   const season = require('../../model/seasons').get()
   const match = new matches.Match({
      key: MATCH_KEY,
      state: CONST.PREGAME,
      venue: fixture.VENUE_KEY,
      away: season.teams[TEAM_KEY],
      home: season.teams[OPPONENT_KEY]
   })

   match.save()
   return match
}

module.exports = {
   RATED_NAME,
   RATED_IPR,
   UNRATED_NAME,
   UNRATED_IPR,
   TEAM_IPR,
   ROSTER_SIZE,
   TEAM_KEY,
   MATCH_KEY,
   setup,
   createPregameMatch
}
