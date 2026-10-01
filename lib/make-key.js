'use strict';

const fs = require('fs');
const util = require('./util');
const DATA_FOLDER = require('../config').DATA_FOLDER;

// A player's key is a hash of their name, so a name change would give them a new
// key and cut them off from their account, stats, and match history. This optional
// file maps a player's new name to the name their key was made from:
//   { "Robert Smith": "Bob Smith" }
// Restart the server after editing it.
const ALIASES_FILE = DATA_FOLDER + '/player-name-aliases.json';

function normalize(name) {
  return name.trim().toLowerCase();
}

function loadAliases() {
  if(!util.fileExists(ALIASES_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(ALIASES_FILE));
    return Object.keys(raw).reduce((aliases, name) => {
      aliases[normalize(name)] = normalize(raw[name]);
      return aliases;
    }, {});
  } catch (err) {
    console.error('Ignoring player name aliases; could not read', ALIASES_FILE, err.message);
    return {};
  }
}

const aliases = loadAliases();

function mappedName(name) {
  const lcName = normalize(name);
  return aliases[lcName] || lcName;
}

module.exports = (name) => util.digest(mappedName(name));
