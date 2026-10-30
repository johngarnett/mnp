/*
  The match pages render for the format in use: the handicap column and
  "Expected HCP" appear only for formats with a handicap, the game page names
  the game type from the format, and a round the format doesn't have redirects.
  Runs under ten-player (the default) and, via FIVE_PLAYER_PAGES=1, five-player
  (tests/match-pages-five.test.js sets it).
*/
const fivePlayer = !!process.env.FIVE_PLAYER_PAGES;
process.env.MATCH_FORMAT = fivePlayer ? 'five-player' : 'ten-player';

process.env.BRANDING_FOLDER = require('node:path').join(__dirname, '..', 'branding', 'example');
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fixture = require('./helpers/fixture');
const { rosterFor } = require('./helpers/simulate-match');

const HTTP_OK = 200;
const HTTP_REDIRECT = 302;
const HANDICAP_HEADER = '>H</td>';
const EXPECTED_HCP = 'Expected HCP';
const TEAM = { awayKey: 'PGA', homeKey: 'PGH' };
const MATCH_KEY = fivePlayer ? 'slp-1-1-pages' : 'mnp-1-1-pages';

// lib/formats reads only MATCH_FORMAT, so it is safe to load before the fixture.
const format = require('../lib/formats');
const size = format.lineup.max;
const roster = [...rosterFor(TEAM.awayKey, size), ...rosterFor(TEAM.homeKey, size)];

fixture.setup({ ratings: roster });

const { simulate } = require('./helpers/simulate-match');
const makeKey = require('../lib/make-key');

roster.forEach(p => fixture.createPlayer({ key: makeKey(p.name), name: p.name }));

const match = simulate({
  key: MATCH_KEY,
  shape: format.rounds,
  awaySize: size,
  homeSize: size,
  ...TEAM
});
// The list page shows the matches the model has loaded; load the saved file.
require('../model/matches').get(MATCH_KEY);
const app = fixture.createApp();
const missingRound = format.regularRounds + 1 + (format.tieBreaker ? 1 : 0);

describe(`match pages under ${format.name}`, () => {
  after(() => fixture.cleanup());

  it('lists matches, with the handicap column only when the format has one', async () => {
    const res = await request(app).get('/matches');

    assert.equal(res.status, HTTP_OK);
    assert.equal(res.text.includes(HANDICAP_HEADER), format.handicap.enabled);
  });

  it('shows the match, venue and team pages', async () => {
    for (const path of [
      `/matches/${MATCH_KEY}`,
      `/matches/${MATCH_KEY}/venue`,
      `/matches/${MATCH_KEY}/away`
    ]) {
      const res = await request(app).get(path);

      assert.equal(res.status, HTTP_OK, path);
      assert.equal(res.text.includes(HANDICAP_HEADER), format.handicap.enabled, path);
    }
    const team = await request(app).get(`/matches/${MATCH_KEY}/home`);

    assert.equal(team.text.includes(EXPECTED_HCP), format.handicap.enabled);
  });

  it('names the game type from the format on the game page', async () => {
    const doubles = await request(app).get(`/games/${MATCH_KEY}.1.1`);
    const singles = await request(app).get(`/games/${MATCH_KEY}.2.1`);

    assert.equal(doubles.status, HTTP_OK);
    assert.ok(doubles.text.includes('Game 1 &middot; Doubles'));
    assert.equal(singles.status, HTTP_OK);
    assert.ok(singles.text.includes('Game 1 &middot; Singles'));
  });

  it('redirects a round the format does not have', async () => {
    const res = await request(app).get(`/games/${MATCH_KEY}.${missingRound}.1`);

    assert.equal(res.status, HTTP_REDIRECT);
    assert.equal(res.headers.location, `/matches/${MATCH_KEY}`);
  });

  it('finished the simulated match', () => {
    assert.equal(match.isDone(), true);
  });
});
