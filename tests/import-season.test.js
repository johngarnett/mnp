/*
  importers/import-season.js writes <DATA_FOLDER>/<season>/season.json from the
  season's CSV files, keying league matches with the branding's prefix.
*/
const path = require('node:path');
process.env.BRANDING_FOLDER = path.join(__dirname, '..', 'branding', 'example');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const fixture = require('./helpers/fixture');

const dataFolder = fixture.setup();
const brand = require('../lib/branding');

const SEASON = 'season-7';
const NUM_WEEKS = '2';
const FILES = {
  'venues.csv': ['BAR,The Bar', 'PUB,The Pub'],
  'teams.csv': ['RED,BAR,Red Team,1', 'BLU,PUB,Blue Team,1', 'GRN,BAR,Green Team,1'],
  'rosters.csv': [
    'ann able,Ann Able,RED,C',
    'bo baker,Bo Baker,RED,A',
    'cy cole,Cy Cole,BLU,C',
    'di dunn,Di Dunn,GRN,C'
  ],
  'matches.csv': ['1,20260910,BLU,RED,BAR', '2,20260917,GRN,BLU,PUB', '2,20260917,RED,GRN,BAR'],
  'groups.csv': ['A,Group A,RED,BLU,GRN']
};

describe('importers/import-season.js', () => {
  let season;

  before(() => {
    const dir = path.join(dataFolder, SEASON);
    fs.mkdirSync(dir, { recursive: true });
    Object.entries(FILES).forEach(([name, lines]) =>
      fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n')
    );

    const result = spawnSync(process.execPath, ['importers/import-season.js', SEASON], {
      env: { ...process.env, NUM_WEEKS },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    season = JSON.parse(fs.readFileSync(path.join(dir, 'season.json')));
  });

  after(() => fixture.cleanup());

  it('keys league matches with the branding prefix, season and week', () => {
    const week1 = season.weeks.find(w => String(w.n) === '1');

    assert.equal(week1.matches[0].match_key, `${brand.matchKeyPrefix}-7-1-BLU-RED`);
    assert.equal(week1.matches[0].home_key, 'RED');
    assert.equal(week1.matches[0].away_key, 'BLU');
  });
});
