/*
   The five-player format (lib/formats/five-player.js): 2/5/5/2 games, singles
   rounds shortened for a 4-player lineup, a 5-point bonus for a full lineup
   that a team forfeits for an illegal substitution, no handicap, and a singles
   tie-breaker round when the match is tied after round 4.
*/
process.env.MATCH_FORMAT = 'five-player'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const fixture = require('./helpers/fixture')
const { rosterFor } = require('./helpers/simulate-match')

const FULL = 5
const SHORT = 4
const GAMES_PER_ROUND = [2, 5, 5, 2]
const GAMES_FOR_SHORT_LINEUP = [2, 4, 4, 2]
const REGULAR_ROUNDS = 4
const TIE_BREAKER_ROUND = 5
const FULL_BONUS = 5
const ROUNDS_FOR_CREDIT = 3
const PLAYER_ROUNDS_PER_TEAM = 18
const WIN_SCORE = 3000
const LOSS_SCORE = 1000
const SINGLES_DOUBLED_POINTS = 3

const TEAMS = {
   decisive: { awayKey: 'DVA', homeKey: 'DVH', awaySize: FULL, homeSize: FULL },
   tied: { awayKey: 'TDA', homeKey: 'TDH', awaySize: FULL, homeSize: FULL },
   short: { awayKey: 'SHA', homeKey: 'SHH', awaySize: SHORT, homeSize: FULL },
   illegal: { awayKey: 'ILA', homeKey: 'ILH', awaySize: FULL, homeSize: FULL }
}
const GROUP_KEY = 'five'

function matchKey(name) {
   return `slp-1-1-${name}`
}

function seasonFor(scenarios) {
   const teams = {}
   Object.values(scenarios).forEach(s => {
      teams[s.awayKey] = { key: s.awayKey, name: `${s.awayKey} Team`, division: 1 }
      teams[s.homeKey] = { key: s.homeKey, name: `${s.homeKey} Team`, division: 1 }
   })
   return {
      teams,
      groups: { [GROUP_KEY]: { name: 'Five', teams: Object.keys(teams) } },
      weeks: [{ n: 1, isSpecial: false, isPlayoffs: false, matches: Object.keys(scenarios).map(name => ({ match_key: matchKey(name) })) }]
   }
}

fixture.setup({
   ratings: Object.values(TEAMS).flatMap(s => [...rosterFor(s.awayKey, s.awaySize), ...rosterFor(s.homeKey, s.homeSize)]),
   season: seasonFor(TEAMS)
})

const { simulate, playExtraRound } = require('./helpers/simulate-match')
const format = require('../lib/formats')
const matches = require('../model/matches')
const CONST = require('../constants')
const getStandings = require('../lib/get-standings')
const seasons = require('../model/seasons')

// Rounds 1, 3 and the tie-breaker are picked by the away team, which fills the odd slots.
function awayHasOddSlots(round) {
   return format.roundSpec(round).firstPick === 'away'
}

// The away team wins every game.
function awayWins(round, game, slot) {
   const isAway = awayHasOddSlots(round) ? slot % 2 === 1 : slot % 2 === 0
   return isAway ? WIN_SCORE : LOSS_SCORE
}

// The picking team wins every game: 10 + 15 for each side, a tie.
function firstPickWins(round, game, slot) {
   return slot % 2 === 1 ? WIN_SCORE : LOSS_SCORE
}

function gamesPerRound(match) {
   return match.rounds.map(round => round.games.length)
}

function totalPlayed(team) {
   return team.lineup.reduce((sum, p) => sum + p.num_played, 0)
}

describe('five-player format', () => {
   after(() => fixture.cleanup())

   it('is selected by MATCH_FORMAT and has no handicap', () => {
      assert.equal(format.name, 'five-player')
      assert.equal(format.handicap.enabled, false)
      assert.equal(format.regularRounds, REGULAR_ROUNDS)
      assert.equal(format.tieBreakerRound, TIE_BREAKER_ROUND)
      assert.equal(format.playerRoundsPerMatch, PLAYER_ROUNDS_PER_TEAM)
   })

   it('plays 2/5/5/2 games and completes a decided match after round 4', () => {
      const match = simulate({ key: matchKey('decisive'), shape: format.rounds, scoreFor: awayWins, ...TEAMS.decisive })
      const points = match.getPoints()

      assert.deepEqual(gamesPerRound(match), GAMES_PER_ROUND)
      assert.equal(match.state, CONST.COMPLETE)
      assert.equal(match.rounds.length, REGULAR_ROUNDS)
      assert.equal(points.tieBreaker, null)
      assert.ok(points.away > points.home)
      assert.equal(match.getResult(), 'away')
      assert.equal(match.isDone(), true)
   })

   it('gives a full lineup 5 bonus points and no handicap', () => {
      const match = matches.get(matchKey('decisive'))
      const points = match.getPoints()

      assert.deepEqual(points.bonus.away, { participation: FULL_BONUS, handicap: 0 })
      assert.deepEqual(points.bonus.home, { participation: FULL_BONUS, handicap: 0 })
      assert.equal(totalPlayed(match.away), PLAYER_ROUNDS_PER_TEAM)
      assert.ok(match.away.lineup.every(p => p.num_played >= ROUNDS_FOR_CREDIT))
   })

   it('shortens the singles rounds for a 4-player lineup, which earns no bonus', () => {
      const match = simulate({ key: matchKey('short'), shape: format.rounds, scoreFor: awayWins, ...TEAMS.short })
      const points = match.getPoints()

      assert.deepEqual(gamesPerRound(match), GAMES_FOR_SHORT_LINEUP)
      assert.equal(match.state, CONST.COMPLETE)
      assert.equal(points.bonus.away.participation, 0)
      assert.equal(points.bonus.home.participation, FULL_BONUS)
   })

   it('forfeits the bonus for an illegal substitution', () => {
      const match = simulate({ key: matchKey('illegal'), shape: format.rounds, scoreFor: awayWins, ...TEAMS.illegal })

      match.home.illegalSubstitution = true
      const points = match.getPoints()

      assert.equal(points.bonus.home.participation, 0)
      assert.equal(points.bonus.away.participation, FULL_BONUS)
   })

   it('enters a singles tie-breaker picked by the away team when tied after round 4', () => {
      const match = simulate({ key: matchKey('tied'), shape: format.rounds, scoreFor: firstPickWins, ...TEAMS.tied })
      const points = match.getPoints()

      assert.equal(points.home, points.away)
      assert.equal(match.state, CONST.PICKING)
      assert.equal(match.round, TIE_BREAKER_ROUND)
      assert.equal(match.rounds.length, TIE_BREAKER_ROUND)
      assert.equal(match.rounds[TIE_BREAKER_ROUND - 1].games.length, format.tieBreaker.games)
      assert.equal(match.getOrder(TIE_BREAKER_ROUND)[0], match.away)
      assert.equal(match.isDone(), false)
      assert.equal(match.getResult(), null)
   })

   it('settles the match by the tie-breaker without changing the totals or games played', () => {
      const match = matches.get(matchKey('tied'))
      const before = match.getPoints()

      playExtraRound(match, format.tieBreaker, awayWins)
      const points = match.getPoints()

      assert.equal(match.state, CONST.COMPLETE)
      assert.deepEqual(points.tieBreaker, { n: TIE_BREAKER_ROUND, home: 0, away: SINGLES_DOUBLED_POINTS })
      assert.equal(points.home, before.home)
      assert.equal(points.away, before.away)
      assert.equal(match.getResult(), 'away')
      assert.equal(match.isDone(), true)
      assert.equal(totalPlayed(match.away) + totalPlayed(match.home), 2 * PLAYER_ROUNDS_PER_TEAM)
   })

   it('counts the tie-breaker winner as the winner in the standings', () => {
      const [group] = getStandings(seasons.get(), matches)
      const byKey = Object.fromEntries(group.map(team => [team.key, team]))

      assert.deepEqual(byKey[TEAMS.tied.awayKey].wins, [TEAMS.tied.homeKey])
      assert.deepEqual(byKey[TEAMS.tied.homeKey].losses, [TEAMS.tied.awayKey])
      assert.deepEqual(byKey[TEAMS.tied.homeKey].ties, [])
   })
})
