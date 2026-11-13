/*
  Shared data for the browser tests: one finished match in the format in
  use, on the schedule so it counts in the standings, with the admin logged in
  under a known session ID.
*/
const fixture = require('./fixture');
const { rosterFor } = require('./simulate-match');

const AWAY_KEY = 'E2A';
const HOME_KEY = 'E2H';
const SESSION_ID = 'pages-admin';
const GROUP_KEY = 'e2e';
// lib/formats reads only MATCH_FORMAT, so it is safe before fixture.setup();
// lib/branding reads config (DATA_FOLDER), so it is loaded in matchKey().
const format = require('../../lib/formats');
const size = format.lineup.max;

function matchKey() {
  return `${require('../../lib/branding').matchKeyPrefix}-1-1-${AWAY_KEY}-${HOME_KEY}`;
}

// A team's season.json roster: the names of its players.
function names(teamKey) {
  return rosterFor(teamKey, size).map(({ name }) => ({ name }));
}

const options = {
  ratings: [...rosterFor(AWAY_KEY, size), ...rosterFor(HOME_KEY, size)]
};

// Must be called after fixture.setup(), since it loads app modules.
function seed() {
  const { simulate } = require('./simulate-match');

  fixture.addToSeason({
    teams: {
      [AWAY_KEY]: { key: AWAY_KEY, name: 'Away Browsers', division: 1, roster: names(AWAY_KEY) },
      [HOME_KEY]: { key: HOME_KEY, name: 'Home Browsers', division: 1, roster: names(HOME_KEY) }
    },
    groups: { [GROUP_KEY]: { key: GROUP_KEY, name: 'Browser Group', teams: [AWAY_KEY, HOME_KEY] } },
    weeks: [{ n: 1, isSpecial: false, isPlayoffs: false, matches: [{ match_key: matchKey() }] }]
  });
  simulate({
    key: matchKey(),
    shape: format.rounds,
    awaySize: size,
    homeSize: size,
    awayKey: AWAY_KEY,
    homeKey: HOME_KEY
  });
  require('../../model/matches').get(matchKey());
  fixture.login(fixture.ADMIN_KEY, SESSION_ID);
}

module.exports = { options, seed, matchKey, SESSION_ID };
