/*
  Plays a match through the model's own API (teamReady, confirmLineup, makePicks,
  reportScores, confirmScores) the way the routes would, with deterministic
  lineups and scores. The caller passes the round shape explicitly instead of the
  app's format so the golden snapshots do not depend on the code under test.

  simulate({ key, awayKey, homeKey, awaySize, homeSize, shape, rounds, scoreFor })
      shape:    [{ games, playersPerGame }] for the regular rounds
      rounds:   how many rounds to play (default: all of shape)
      scoreFor: (round, game, slot) => score; slots are 1-4 as in the game fields

  Rosters are "<Team> P01".."<Team> Pnn"; the first player is the captain. Player
  IPRs come from the ratings the caller passed to fixture.setup() (see rosterFor).
*/
const DEFAULT_SCORE_UNIT = 1000;
const SCORE_SPREAD = 9;
const PLAYER_NAME_WIDTH = 2;
// Slots filled by the picking team and by the responding team, in game order.
const PICKING_SLOTS = [1, 3];
const RESPONDING_SLOTS = [2, 4];

function playerName(teamName, n) {
  return `${teamName} P${String(n).padStart(PLAYER_NAME_WIDTH, '0')}`;
}

// Roster entries for fixture.setup({ ratings }) and for the Match constructor.
function rosterFor(teamName, size, iprs = []) {
  return Array.from({ length: size }, (_, i) => ({
    name: playerName(teamName, i + 1),
    ipr: iprs[i] === undefined ? 1 : iprs[i]
  }));
}

function teamParams(key, name, roster) {
  return {
    key,
    name,
    captain: roster[0].name,
    roster: roster.map(({ name }) => ({ name }))
  };
}

// Varied, tie-free scores: no two slots in a game share a score.
function defaultScoreFor(round, game, slot) {
  return DEFAULT_SCORE_UNIT * (1 + ((round * round * 11 + game * 3 + slot * 5) % SCORE_SPREAD));
}

// Players with the fewest games so far, then in lineup order.
function pickPlayers(team, count) {
  return team.lineup
    .map((p, i) => ({ key: p.key, played: p.num_played || 0, i }))
    .sort((a, b) => a.played - b.played || a.i - b.i)
    .slice(0, count)
    .map(p => p.key);
}

function fail(err) {
  if (err && (!Array.isArray(err) || err.length)) {
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
  }
}

function submitPicks(match, team, slots, round, machines) {
  const playersPerTeam = slots.length;
  const keys = pickPlayers(team, round.games.length * playersPerTeam);
  const picks = {};

  round.games.forEach((game, g) => {
    if (machines) picks[`machine.${game.n}`] = machines[g % machines.length];
    slots.forEach((slot, s) => {
      picks[`player_${slot}.${game.n}`] = keys[g * playersPerTeam + s];
    });
  });
  match.makePicks({ ukey: team.captains[0].key, state: match.state, round: round.n, picks }, fail);
}

function playRound(match, roundSpec, scoreFor) {
  const CONST = require('../../constants');
  // What the match page does before showing the picks: a short lineup may
  // shorten the round in formats with lineup.truncateGamesToLineup.
  match.truncateGamesIfNeeded(match.round);
  const round = match.getRound(match.round);
  const [picking, responding] = match.getOrder(match.round);
  const slotsPerTeam = roundSpec.playersPerGame / 2;
  const pickingSlots = PICKING_SLOTS.slice(0, slotsPerTeam);
  const respondingSlots = RESPONDING_SLOTS.slice(0, slotsPerTeam);

  match.getPoints(); // refreshes num_played, which the pick order uses
  submitPicks(match, picking, pickingSlots, round, match.venue.machines);
  submitPicks(match, responding, respondingSlots, round);
  if (match.state !== CONST.PLAYING)
    throw new Error(`Picks did not complete round ${round.n}: state ${match.state}`);

  round.games.forEach(game => {
    const update = {};
    for (let slot = 1; slot <= roundSpec.playersPerGame; slot++) {
      update[`score_${slot}`] = String(scoreFor(round.n, game.n, slot));
    }
    match.reportScores({ ukey: game.player_1, n: game.n, round: round.n, update }, fail);
  });
  match.confirmScores({ ukey: picking.captains[0].key, side: 'left' }, fail);
  match.confirmScores({ ukey: responding.captains[0].key, side: 'right' }, fail);
}

function simulate({
  key,
  awayKey,
  homeKey,
  awaySize,
  homeSize,
  awayIprs,
  homeIprs,
  shape,
  rounds,
  scoreFor,
  venue
}) {
  const fixture = require('./fixture');
  const matches = require('../../model/matches');
  const awayRoster = rosterFor(awayKey, awaySize, awayIprs);
  const homeRoster = rosterFor(homeKey, homeSize, homeIprs);
  const match = new matches.Match({
    key,
    name: `${awayKey} @ ${homeKey}`,
    week: 1,
    venue: venue || fixture.VENUE_KEY,
    away: teamParams(awayKey, `${awayKey} Team`, awayRoster),
    home: teamParams(homeKey, `${homeKey} Team`, homeRoster)
  });
  const roundsToPlay = rounds === undefined ? shape.length : rounds;
  const scores = scoreFor || defaultScoreFor;

  match.teamReady({ side: 'away', ukey: match.away.captains[0].key }, fail);
  match.teamReady({ side: 'home', ukey: match.home.captains[0].key }, fail);
  match.confirmLineup({ side: 'away', ukey: match.away.captains[0].key }, fail);
  match.confirmLineup({ side: 'home', ukey: match.home.captains[0].key }, fail);

  for (let r = 0; r < roundsToPlay; r++) {
    playRound(match, shape[r], scores);
  }
  return match;
}

// Plays one more round (used for a tie-breaker that the match entered on its own).
function playExtraRound(match, roundSpec, scoreFor) {
  playRound(match, roundSpec, scoreFor || defaultScoreFor);
}

module.exports = { simulate, playExtraRound, rosterFor, playerName, defaultScoreFor };
