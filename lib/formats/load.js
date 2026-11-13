/*
  Loads and validates a match format by name from this folder. lib/formats
  (index.js) exports the one selected by MATCH_FORMAT; tests load others.
*/
const path = require('path');

const FORMAT_NAME_PATTERN = /^[a-z0-9-]+$/;
const GAME_TYPES = ['doubles', 'singles'];
const PLAYERS_PER_TYPE = { doubles: 4, singles: 2 };
const SIDES = ['away', 'home'];
const STANDINGS_RANKINGS = ['pops', 'points'];

function fail(message) {
  throw new Error(`MATCH_FORMAT: ${message}`);
}

function checkRound(spec, label) {
  if (!spec || typeof spec !== 'object') fail(`${label} must be an object`);
  if (!Number.isInteger(spec.games) || spec.games < 1)
    fail(`${label}.games must be a positive integer`);
  if (!GAME_TYPES.includes(spec.type))
    fail(`${label}.type must be one of ${GAME_TYPES.join(', ')}`);
  if (spec.playersPerGame !== PLAYERS_PER_TYPE[spec.type])
    fail(`${label}.playersPerGame must be ${PLAYERS_PER_TYPE[spec.type]} for ${spec.type}`);
  if (!SIDES.includes(spec.firstPick)) fail(`${label}.firstPick must be away or home`);
}

function validate(format) {
  if (!Array.isArray(format.rounds) || !format.rounds.length)
    fail('rounds must be a non-empty array');
  format.rounds.forEach((spec, i) => checkRound(spec, `rounds[${i}]`));
  if (format.tieBreaker !== null) checkRound(format.tieBreaker, 'tieBreaker');
  const { lineup, participationBonus, handicap, standings } = format;
  if (
    !lineup ||
    !Number.isInteger(lineup.min) ||
    !Number.isInteger(lineup.max) ||
    lineup.min > lineup.max
  ) {
    fail('lineup.min and lineup.max must be integers with min <= max');
  }
  if (!participationBonus || !Number.isInteger(participationBonus.roundsForCredit))
    fail('participationBonus.roundsForCredit must be an integer');
  if (
    !participationBonus.byPlayersWithCredit ||
    typeof participationBonus.byPlayersWithCredit !== 'object'
  )
    fail('participationBonus.byPlayersWithCredit must be an object');
  if (!handicap || typeof handicap.enabled !== 'boolean')
    fail('handicap.enabled must be true or false');
  if (
    handicap.enabled &&
    ![handicap.targetIpr, handicap.divisor, handicap.cap].every(Number.isFinite)
  ) {
    fail('handicap needs numeric targetIpr, divisor and cap when enabled');
  }
  if (!standings || !STANDINGS_RANKINGS.includes(standings.rankBy))
    fail(`standings.rankBy must be one of ${STANDINGS_RANKINGS.join(', ')}`);
}

function load(name) {
  if (!FORMAT_NAME_PATTERN.test(name))
    fail(`"${name}" is not a format name (letters, digits and dashes)`);
  let format;
  try {
    format = require(path.join(__dirname, name));
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') fail(`no format named "${name}" in lib/formats`);
    throw err;
  }
  validate(format);

  const regularRounds = format.rounds.length;
  const tieBreakerRound = format.tieBreaker ? regularRounds + 1 : null;

  return Object.freeze({
    ...format,
    regularRounds,
    tieBreakerRound,
    // The round descriptor for round n (1-based), or undefined for a round the format doesn't have.
    roundSpec(n) {
      if (Number(n) === tieBreakerRound) return format.tieBreaker;
      return format.rounds[Number(n) - 1];
    },
    isTieBreaker(n) {
      return Number(n) === tieBreakerRound;
    },
    // Player-rounds each team plays in a full match: 2 per doubles game, 1 per singles game.
    playerRoundsPerMatch: format.rounds.reduce(
      (sum, spec) => sum + (spec.games * spec.playersPerGame) / 2,
      0
    )
  });
}

module.exports = load;
// For tests of the checks themselves.
module.exports.validate = validate;
