/*
  Reads and validates a branding folder (see lib/branding.js for the fields).
  lib/branding exports the one named by BRANDING_FOLDER; tests load others.
*/
const fs = require('fs');
const path = require('path');

const LEAGUE_FILE = 'league.json';
const PAGES_DIR = 'pages';
const EMAIL_DIR = 'email';
const STATIC_DIR = 'static';
const REQUIRED_STRINGS = ['name', 'shortName', 'titlePrefix', 'timeZone', 'matchKeyPrefix'];
const MATCH_KEY_PREFIX_PATTERN = /^[a-z0-9]+$/;
const DEFAULT_PAGE_FILES = {
  index: 'index.html',
  leaguerules: 'leaguerules.html',
  matchrules: 'matchrules.html',
  newplayers: 'newplayers.html',
  ratings: 'ratings.html',
  handicapping: 'handicapping.html',
  'new-teams': 'new-teams.html',
  thanks: 'thanks.html'
};
const EMAIL_FILES = { verify: 'verify.html', forgotPassword: 'forgotpass.html' };

function load(brandingFolder) {
  const folder = path.resolve(brandingFolder);
  const fail = message => {
    throw new Error(`BRANDING_FOLDER (${folder}): ${message}`);
  };
  const checkMenu = (menu, label) => {
    if (!Array.isArray(menu)) fail(`${label} must be an array of {label, href}`);
    menu.forEach((item, i) => {
      if (!item || typeof item.label !== 'string' || typeof item.href !== 'string') {
        fail(`${label}[${i}] needs a label and an href`);
      }
    });
  };
  const file = path.join(folder, LEAGUE_FILE);
  if (!fs.existsSync(file))
    fail(`no ${LEAGUE_FILE}; point BRANDING_FOLDER at a branding checkout (see docs/branding.md)`);
  let league;
  try {
    league = JSON.parse(fs.readFileSync(file));
  } catch (err) {
    fail(`${LEAGUE_FILE} is not valid JSON: ${err.message}`);
  }
  REQUIRED_STRINGS.forEach(key => {
    if (typeof league[key] !== 'string' || !league[key])
      fail(`${LEAGUE_FILE} needs a "${key}" string`);
  });
  if (!MATCH_KEY_PREFIX_PATTERN.test(league.matchKeyPrefix))
    fail('matchKeyPrefix must be lowercase letters and digits');
  checkMenu(league.mainMenu, 'mainMenu');
  if (league.playerMenu !== null && league.playerMenu !== undefined)
    checkMenu(league.playerMenu, 'playerMenu');

  const pageFiles = { ...DEFAULT_PAGE_FILES, ...(league.pages || {}) };
  const subjects = {
    verify: `${league.shortName} - Confirm Email`,
    forgotPassword: `${league.shortName} - Reset Password`,
    ...(league.emailSubjects || {})
  };

  return Object.freeze({
    ...league,
    playerMenu: league.playerMenu || null,
    hasPlayerMenu: !!league.playerMenu,
    emailSubjects: subjects,
    folder,
    staticDir: path.join(folder, STATIC_DIR),
    pageFiles,
    // Path of a content page's file, by page name (null for a page the branding doesn't define).
    pageFile(name) {
      return pageFiles[name] ? path.join(folder, PAGES_DIR, pageFiles[name]) : null;
    },
    emailFile(name) {
      return path.join(folder, EMAIL_DIR, EMAIL_FILES[name]);
    },
    staticFile(name) {
      return path.join(folder, STATIC_DIR, name);
    }
  });
}

module.exports = load;
