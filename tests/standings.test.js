/*
  lib/get-standings.js orders teams by win/loss/tie record, then by the stat the
  format's standings.rankBy names: total points (five-player) or POPS, the
  average share of the points in a team's matches (ten-player). The two can
  disagree, so each format is checked with a season where they do.
*/
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const load = require('../lib/formats/load');
const getStandings = require('../lib/get-standings');

// get-standings logs every match it counts.
console.log = () => {};

const GROUP = 'g';
// Two undefeated teams: BIG scores more points in total, EVEN wins its matches
// by wider margins, so EVEN has the higher POPS.
const BIG = 'BIG';
const EVEN = 'EVN';
const LOSERS = ['LS1', 'LS2'];
const MATCHES = [
  { key: 'm1', home: BIG, away: LOSERS[0], homePoints: 50, awayPoints: 30 },
  { key: 'm2', home: BIG, away: LOSERS[1], homePoints: 30, awayPoints: 29 },
  { key: 'm3', home: EVEN, away: LOSERS[0], homePoints: 45, awayPoints: 5 },
  { key: 'm4', home: EVEN, away: LOSERS[1], homePoints: 30, awayPoints: 25 }
];
const BIG_TOTAL = 80;
const EVEN_TOTAL = 75;
const EVEN_POPS = '0.722'; // (45/50 + 30/55) / 2
const BIG_POPS = '0.566'; // (50/80 + 30/59) / 2

function fakeMatch({ home, away, homePoints, awayPoints }) {
  return {
    home: { key: home },
    away: { key: away },
    getPoints: () => ({ home: homePoints, away: awayPoints }),
    isDone: () => true,
    getResult: () => (homePoints > awayPoints ? 'home' : homePoints < awayPoints ? 'away' : 'tie')
  };
}

const matches = {
  get: key => {
    const spec = MATCHES.find(m => m.key === key);
    return spec ? fakeMatch(spec) : null;
  }
};

const keys = [BIG, EVEN, ...LOSERS];
const season = {
  teams: Object.fromEntries(keys.map(key => [key, { key, name: `${key} Team`, division: 1 }])),
  groups: { [GROUP]: { key: GROUP, name: 'Group', teams: keys } },
  weeks: [
    {
      n: 1,
      isSpecial: false,
      isPlayoffs: false,
      matches: MATCHES.map(m => ({ match_key: m.key }))
    }
  ]
};

function order(format) {
  const [group] = getStandings(season, matches, format);
  return group.map(team => team.key);
}

describe('standings ranking after the record', () => {
  it('computes both stats for every team', () => {
    const [group] = getStandings(season, matches, load('ten-player'));
    const byKey = Object.fromEntries(group.map(team => [team.key, team]));

    assert.equal(byKey[BIG].points, BIG_TOTAL);
    assert.equal(byKey[EVEN].points, EVEN_TOTAL);
    assert.equal(byKey[BIG].pops, BIG_POPS);
    assert.equal(byKey[EVEN].pops, EVEN_POPS);
    assert.deepEqual(byKey[BIG].wins, LOSERS);
    assert.deepEqual(byKey[EVEN].wins, LOSERS);
  });

  it('ten-player ranks on POPS', () => {
    assert.deepEqual(order(load('ten-player')).slice(0, 2), [EVEN, BIG]);
  });

  it('five-player ranks on total points', () => {
    assert.deepEqual(order(load('five-player')).slice(0, 2), [BIG, EVEN]);
  });

  it('the record comes first either way', () => {
    // Both losers lost twice; the stats then order them.
    for (const name of ['ten-player', 'five-player']) {
      const [, , third, fourth] = order(load(name));
      assert.deepEqual([third, fourth].sort(), [...LOSERS].sort());
    }
  });
});

describe('a format must say how standings are ranked', () => {
  it('rejects an unknown standings.rankBy', () => {
    const bad = { ...require('../lib/formats/five-player'), standings: { rankBy: 'wins' } };

    assert.throws(() => load.validate(bad), /standings\.rankBy must be one of pops, points/);
  });
});
