/*
   Ported from mnp 3605131 and fc34983: an admin can add
      "point_adjust": { "home_points": <n>, "away_points": <n> }
   to a match file to adjust its score for forfeits and suspended matches. A
   negative adjustment comes out of the team's bonus when the bonus covers it,
   otherwise out of its points. NESLP treats a missing value as 0.
*/
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const fixture = require('./helpers/fixture')

const dataFolder = fixture.setup()

const SAVED_KEY = 'slp-test-8-ADJA-ADJH'
const HOME_GAME_POINTS = 4
const AWAY_GAME_POINTS = 2
const BONUS = 5

// A match file on disk with an admin's adjustment, loaded when model/matches loads.
fs.writeFileSync(path.join(dataFolder, fixture.TEST_SEASON, 'matches', `${SAVED_KEY}.json`), JSON.stringify({
   key: SAVED_KEY,
   venue: fixture.VENUE_KEY,
   away: { key: 'ADJA', name: 'Adjust Away', lineup: [] },
   home: { key: 'ADJH', name: 'Adjust Home', lineup: [] },
   point_adjust: { home_points: 0, away_points: -3 }
}))

const matches = require('../model/matches')

// Home scores HOME_GAME_POINTS and away AWAY_GAME_POINTS in round 1; each team's
// bonus is fixed so the bonus rules are tested in isolation.
function scoredMatch(pointAdjust, bonus = BONUS) {
   const match = new matches.Match({
      venue: fixture.VENUE_KEY,
      away: { key: 'ADJA', name: 'Adjust Away' },
      home: { key: 'ADJH', name: 'Adjust Home' }
   })
   const game = match.rounds[0].games[0]

   game.home_points = HOME_GAME_POINTS
   game.away_points = AWAY_GAME_POINTS
   match.home.getBonusPoints = () => bonus
   match.away.getBonusPoints = () => bonus
   if (pointAdjust) match.point_adjust = pointAdjust
   return match
}

describe('manual point adjust', () => {
   it('leaves points alone without an adjustment', () => {
      const points = scoredMatch().getPoints()

      assert.equal(points.home, HOME_GAME_POINTS + BONUS)
      assert.equal(points.away, AWAY_GAME_POINTS + BONUS)
   })

   it('adds a positive adjustment to the points', () => {
      const points = scoredMatch({ home_points: 0, away_points: 3 }).getPoints()

      assert.equal(points.away, AWAY_GAME_POINTS + BONUS + 3)
      assert.equal(points.bonus.away, BONUS)
      assert.equal(points.home, HOME_GAME_POINTS + BONUS)
   })

   it('takes a negative adjustment out of the bonus when the bonus covers it', () => {
      const points = scoredMatch({ home_points: -2, away_points: -BONUS }).getPoints()

      assert.equal(points.bonus.home, BONUS - 2)
      assert.equal(points.home, HOME_GAME_POINTS + BONUS - 2)
      assert.equal(points.bonus.away, 0)
      assert.equal(points.away, AWAY_GAME_POINTS)
   })

   it('takes a negative adjustment bigger than the bonus out of the points', () => {
      const points = scoredMatch({ home_points: -(BONUS + 2), away_points: 0 }).getPoints()

      assert.equal(points.bonus.home, BONUS)
      assert.equal(points.home, HOME_GAME_POINTS + BONUS - (BONUS + 2))
   })

   it('takes a negative adjustment out of the points when there is no bonus', () => {
      const points = scoredMatch({ home_points: -1, away_points: 0 }, 0).getPoints()

      assert.equal(points.bonus.home, 0)
      assert.equal(points.home, HOME_GAME_POINTS - 1)
   })

   it('treats a missing value as 0 and accepts numbers written as strings', () => {
      const points = scoredMatch({ home_points: '2' }).getPoints()

      assert.equal(points.home, HOME_GAME_POINTS + BONUS + 2)
      assert.equal(points.away, AWAY_GAME_POINTS + BONUS)
   })

   it('applies an adjustment saved in the match file', () => {
      const points = matches.get(SAVED_KEY).getPoints()

      assert.equal(points.away, -3)
      assert.equal(points.home, 0)
   })
})
