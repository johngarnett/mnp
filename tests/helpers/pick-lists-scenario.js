/*
   Shared data for the sorted pick list tests: two matches with round 1 (doubles)
   finished, one waiting for the home team to pick round 2 and one waiting for the
   away team to respond. Games played come from the finished round 1 games, and the
   lineups are in neither name nor games-played order. The admin has a known
   session ID so browser tests can log in.
*/
const fixture = require('./fixture')

const PICKING_MATCH_KEY = 'slp-test-2-AWAY-HOME'
const RESPONDING_MATCH_KEY = 'slp-test-3-AWAY-HOME'
const SESSION_ID = 'pick-lists-admin'
const ROUND_TWO = 2
const DOUBLES_ROUND_INDEX = 0

// [name, round 1 games played]; each roster lists players in an unsorted order.
// Round 1 has two doubles games, so each team's counts add up to 4.
const PICKING_ROSTER = [['Zoe Zed', 1], ['Bob Baker', 0], ['Moe Mid', 2], ['Amy Able', 1]]
const RESPONDING_ROSTER = [['Yan Yu', 1], ['Max Moss', 2], ['Cal Cole', 0], ['Ann Ash', 1]]

// Expected dropdown labels: fewest games played first, then by name.
const PICKING_PLAYER_LABELS = ['Bob Baker', '(1) Amy Able', '(1) Zoe Zed', '(2) Moe Mid']
const RESPONDING_PLAYER_LABELS = ['Cal Cole', '(1) Ann Ash', '(1) Yan Yu', '(2) Max Moss']
const MACHINE_LABELS = Object.values(fixture.MACHINE_NAMES).sort()

const options = {}

function makeTeam(key, roster) {
   return { key, name: `${key} Team`, roster: roster.map(([name]) => ({ name })) }
}

// Player keys for a roster, one entry per game played, in roster order.
function gameSlots(team, roster) {
   return roster.flatMap(([name, played]) => {
      const key = team.lineup.find(p => p.name === name).key

      return Array(played).fill(key)
   })
}

// Finishes round 1. Away players fill slots 1 and 3, home players slots 2 and 4.
function playRoundOne(match, awayRoster, homeRoster) {
   const away = gameSlots(match.away, awayRoster)
   const home = gameSlots(match.home, homeRoster)

   match.rounds[DOUBLES_ROUND_INDEX].games.forEach((game, i) => {
      Object.assign(game, {
         machine: fixture.VENUE_MACHINES[i],
         player_1: away[2 * i],
         player_3: away[2 * i + 1],
         player_2: home[2 * i],
         player_4: home[2 * i + 1],
         done: true
      })
   })
}

function createMatch(key, state) {
   const matches = require('../../model/matches')
   const match = new matches.Match({
      key,
      state,
      venue: fixture.VENUE_KEY,
      away: makeTeam('AWAY', RESPONDING_ROSTER),
      home: makeTeam('HOME', PICKING_ROSTER)
   })

   playRoundOne(match, RESPONDING_ROSTER, PICKING_ROSTER)
   match.round = ROUND_TWO
   match.save()
   return match
}

// Must be called after fixture.setup(), since it loads app modules.
function seed() {
   const CONST = require('../../constants')

   // Round 2: the home team picks and the away team responds.
   createMatch(PICKING_MATCH_KEY, CONST.PICKING)
   createMatch(RESPONDING_MATCH_KEY, CONST.RESPONDING)
   fixture.login(fixture.ADMIN_KEY, SESSION_ID)
}

module.exports = {
   PICKING_MATCH_KEY,
   RESPONDING_MATCH_KEY,
   SESSION_ID,
   PICKING_PLAYER_LABELS,
   RESPONDING_PLAYER_LABELS,
   MACHINE_LABELS,
   options,
   seed
}
