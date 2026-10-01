/*
 * Builds <DATA_FOLDER>/<season>/season.json from the season's CSV files.
 *
 * Usage: node importers/import-season.js [season folder] [--number <n>]
 *   season folder  defaults to CURRENT_SEASON (for example 9)
 *   --number       season number used in match keys; defaults to the folder
 *                  name when it is a number (or 13 for "season-13")
 *
 * Match keys are slp-{number}-{week}-{venue}-{home}-{away}.
 *
 * Every team, venue, and date is checked first. If anything is unknown, all the
 * problems are listed and season.json is not written.
 *
 * Adapted from mnp's importer, which made mnp-{season}-{week}-{away}-{home} keys.
 */
const fs = require('fs');
const csv = require('../lib/csv');

const config = require('../config');
const DATA_FOLDER = config.DATA_FOLDER;

const USAGE = 'Usage: node importers/import-season.js [season folder] [--number <n>]';
const BYE = 'BYE';
const DEFAULT_GROUP = { key: 'target', name: 'Target' };

function parseArgs(argv) {
  var args = { folder: null, number: null };
  for(let i = 0; i < argv.length; i++) {
    if(argv[i] == '--number') args.number = argv[++i];
    else args.folder = argv[i];
  }
  return args;
}

function seasonNumberFor(folder) {
  if(/^\d+$/.test(folder)) return folder;
  var match = /^season-(\d+)$/.exec(folder);
  return match ? match[1] : null;
}

const args = parseArgs(process.argv.slice(2));
const CURRENT_SEASON = args.folder || config.CURRENT_SEASON;
const seasonNumber = args.number || seasonNumberFor(CURRENT_SEASON);
const stem = DATA_FOLDER + '/' + CURRENT_SEASON + '/';

if(!seasonNumber || !/^\d+$/.test(seasonNumber)) {
  console.error('Cannot tell the season number for "' + CURRENT_SEASON + '". Pass --number.');
  console.error(USAGE);
  process.exit(1);
}

const missing = ['venues.csv', 'teams.csv', 'rosters.csv', 'matches.csv']
  .filter(file => !fs.existsSync(stem + file));
if(missing.length > 0) {
  console.error('Missing in ' + stem + ': ' + missing.join(', '));
  process.exit(1);
}

const num_regular_season_weeks = config.NUM_WEEKS;
const errors = [];

// Rows with every value trimmed.
function loadRows(file) {
  return csv.load(stem + file).map(row => row.map(value => value.trim()));
}

/*
 * venues.csv is a list of venues in the form
 * FTB,Full Tilt Ballard
 * OLF,Olaf's
 * SHR,Shorty's
 *
 * The following turns this two dimensional array,
 * into a map: key is the venue key | value is the full name.
 */
let rows = loadRows('venues.csv');
const venues = rows.reduce((venues, row) => {
  venues[row[0]] = row[1];
  return venues;
}, {});

/*
 * teams.csv is a list of teams in the form
 * NLT,OLF,Northern Lights,1
 * SJK,FTB,Soda Jerks,1
 *
 * We only care about columns 0,1 and 2.  Previously,
 * we honored column 3 as the division; but we are
 * doing away with that.  But to minimize code churn,
 * we'll keep the team's division, but always make it 0.
 *
 * The following turns the csv array into a map:
 * key is the team key | value is a team object.
 * The team object is initialized with an empty roster,
 * and an empty schedule.
 */
//FIRST, Load up the team data
rows = loadRows('teams.csv');

var teams = {};
rows.forEach((row, i) => {
  var team_key = row[0];
  if(!venues[row[1]]) {
    errors.push('teams.csv row ' + (i+1) + ': team ' + team_key + ' has unknown venue "' + row[1] + '"');
  }
  teams[team_key] = {
    key: team_key,
    venue: row[1],
    name: row[2],
    roster: [],
    schedule: [],
    division: 0
  };
});

//Playoff placeholder teams, allowed in weeks after the regular season.
var pteams = {};
for(let i = 1; i < 13; i++) {
  let team_key = 'S' +i;
  pteams[team_key] = { key: team_key, name: 'Seed #' +i };
}

for(let i = 1; i < 9; i++) {
  let team_key = 'QF' +i;
  pteams[team_key] = { key: team_key, name: 'SF #' +i };
}

pteams['H45'] = { key: 'H45', name: 'SF 4 vs 5' };
pteams['H18'] = { key: 'H18', name: 'SF 1 vs 8' };
pteams['H36'] = { key: 'H36', name: 'SF 3 vs 6' };
pteams['H27'] = { key: 'H27', name: 'SF 2 vs 7' };

pteams['FN1'] = { key: 'FN1', name: 'Finalist #1' };
pteams['FN2'] = { key: 'FN2', name: 'Finalist #2' };
pteams['BR3'] = { key: 'BR3', name: 'Bronze #3' };
pteams['BR4'] = { key: 'BR4', name: 'Bronze #4' };

// A stand-in team for playoff placeholders and byes. Shown unlinked.
function placeholder(team) {
  return { key: team.key, name: team.name, venue: 'TBD', schedule: [], isPlaceholder: true };
}

var labels = {};
var codes = {};
for(let i = 1; i < 20; i++) {
  labels[i] = 'WEEK ' + i;
  codes[i] = 'WK' + i;
}
//NOTE: These labels are for season 9.
//      Earlier seasons did not have a WC round.
//      Also, there are now 2 divisions.
labels[91] = 'Quarter Finals';
labels[92] = 'Semi Finals';
labels[93] = 'Finals & Bronze';

codes[91] = 'QF';
codes[92] = 'SF';
codes[93] = 'FNL';

codes['S'] = 'SCRM';

/*
 * rosters.csv is a list of players in the form
 * Ann Able,RED,C
 * Bo Baker,RED,P
 * Cy Cole,RED,A
 * Di Dunn,BLU,P
 * Ed Ely,BLU,C
 *
 * Column 0 is the player name, column 1 is the team key,
 * column 2 is the enum {C - captain, A - assistant, P - player}
 */
rows = loadRows('rosters.csv');

/*
 * Previously we initialized the teams and populated each
 * with an empty roster array.  Here we are going to populate
 * that roster.  The roster is made up of objects with only
 * the player's name.
 */
rows.forEach((row, i) => {
  let name = row[0];
  let team_key = row[1];
  var team = teams[team_key];
  if(!team) {
    errors.push('rosters.csv row ' + (i+1) + ': unknown team "' + team_key + '" for ' + name);
    return;
  }
  if(row[2] == 'C') team.captain = name;
  if(row[2] == 'A') team.co_captain = name;
  team.roster.push({
    name: name
  });
});

/*
 * matches.csv is a list of matches in the form
 * 1,20200203,DSV,ETB,GET
 * 1,20200203,CRA,KNR,FFD
 * 1,20200203,SWL,SJK,FTB
 * 1,20200203,BOC,PBR,AAB
 * 1,20200203,TWC,SSS,SHR
 *
 * Column 0 is the week number (S for a scrimmage)
 * Column 1 is the date (YYYYMMDD)
 * Column 2 is the away/visiting team
 * Column 3 is the home team
 * Column 4 is the venue
 *
 * Any other week (such as 0) is a special event: column 2 is a team
 * whose venue hosts it, and column 3 is HTML shown on the schedule.
 *
 * We'll give each match a unique key with
 * slp-{seasonNumber}-{week}-{venue}-{home}-{away}
 *
 * Each team's schedule will be built up as an
 * array.  Each object describes the match
 * in terms of the team.
 */
rows = loadRows('matches.csv');
var weeks = {};

function findTeam(key, isPlayoffs, where) {
  if(teams[key]) return teams[key];
  if(key == BYE) return placeholder({ key: BYE, name: BYE });
  if(isPlayoffs && pteams[key]) return placeholder(pteams[key]);
  errors.push(where + ': unknown team "' + key + '"');
  return null;
}

/*
 * Load all the matches to create schedules.
 * Also, build up the 'weeks' array.
 */
rows.forEach((row, i) => {
  let where = 'matches.csv row ' + (i+1);
  let match = {
    key: ['slp', seasonNumber, row[0], row[4], row[3], row[2]].join('-'),
    week: row[0],
    date: row[1],
    away: row[2],
    home: row[3],
    venue: row[4]
  };

  if(!/^\d{8}$/.test(match.date || '')) {
    errors.push(where + ': date "' + match.date + '" is not YYYYMMDD');
    return;
  }

  // I believe week 'S' indicates Scrimmage.
  if(match.week == 'S' || match.week > 0) {
    var isPlayoffs = parseInt(match.week) > parseInt(num_regular_season_weeks);
    var home = findTeam(match.home, isPlayoffs, where);
    var away = findTeam(match.away, isPlayoffs, where);
    if(home && away && home.key == BYE && away.key == BYE) {
      errors.push(where + ': both teams are ' + BYE);
    }
    if(!venues[match.venue]) {
      errors.push(where + ': unknown venue "' + match.venue + '"');
    }
    if(!home || !away || !venues[match.venue]) return;

    home.schedule.push({
      match_key: match.key,
      week: match.week,
      date: match.date,
      side: 'vs',
      opp: {
        key: away.key,
        name: away.name
      }
    });
    away.schedule.push({
      match_key: match.key,
      week: match.week,
      date: match.date,
      side: '@',
      opp: {
        key: home.key,
        name: home.name
      }
    });

    var week = weeks[match.date];
    if(!week) {
      week = {
        n: match.week,
        label: labels[match.week],
        code: codes[match.week],
        isPlayoffs: isPlayoffs,
        isSpecial: match.week == 'S',
        date: match.date,
        matches: []
      };
      weeks[match.date] = week;
    }

    week.matches.push({
      match_key: match.key,
      away_key: away.key,
      away_name: away.name,
      away_linked: !away.isPlaceholder,
      home_key: home.key,
      home_name: home.name,
      home_linked: !home.isPlaceholder,
      venue: { key: match.venue, name: venues[match.venue] }
    });
  }
  else {
    //Week is a special event, hosted at the venue of the team in column 2.
    let host = teams[match.away];
    if(!host) {
      errors.push(where + ': unknown host team "' + match.away + '" for a special event');
      return;
    }
    if(!weeks[match.date]) {
      weeks[match.date] = {
        date: match.date,
        isSpecial: true,
        html: match.home,
        venue: { key: host.venue, name: venues[host.venue] }
      };
    }
  }
});

/*
 * groups.csv (optional) is a list of groups in the form
 * A,SlingshotX  ,BOC,CRA,CDC,DTP,
 * B,PlungerX    ,DND,DSV,DIH,ETB,HHS,
 *
 * Column 0 is the group key
 * Column 1 is the group name
 * Column 2... is the list of team keys
 *
 * Only the standings and the team page need to know about the groups, but the
 * team page needs every team to be in one. Without groups.csv, all teams go in
 * one "target" group.
 */
var groups = {};

if(fs.existsSync(stem + 'groups.csv')) {
  loadRows('groups.csv').forEach((row, i) => {
    let group_key = row[0];
    groups[group_key] = {
      key: group_key,
      name: row[1],
      teams: [],
    };
    row.slice(2).forEach(team => {
      if(team == '') return;
      if(!teams[team]) errors.push('groups.csv row ' + (i+1) + ': unknown team "' + team + '"');
      groups[group_key].teams.push(team);
    });
  });
}
else {
  groups[DEFAULT_GROUP.key] = {
    key: DEFAULT_GROUP.key,
    name: DEFAULT_GROUP.name,
    teams: Object.keys(teams)
  };
}

if(errors.length > 0) {
  console.error(errors.join('\n'));
  console.error('season.json was not written.');
  process.exit(1);
}

/*
 * Weeks come out in date order (YYYYMMDD keys sort numerically).
 * This converts the dates to a friendlier format: 02/03/2021
 */
var list = Object.keys(weeks).map(key => {
  let week = weeks[key];
  var date = week.date;
  week.date = date.substring(4,6) + '/' + date.substring(6,8) + '/' + date.substring(0,4);
  return week;
});

const season = {
  key: CURRENT_SEASON,
  teams: teams,
  weeks: list,
  groups: groups
};

fs.writeFileSync(stem + 'season.json', JSON.stringify(season,null,2));
console.log('Wrote ' + stem + 'season.json: ' + Object.keys(teams).length + ' teams, ' +
  list.length + ' weeks, match keys slp-' + seasonNumber + '-...');
