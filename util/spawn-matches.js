/**
  Creates the match files for a week, so captains can start entering lineups.

  Usage: node util/spawn-matches.js [week]

  With a week number, creates that week's matches. Without one, picks the first
  week whose match day hasn't reached 9pm yet in the league's time zone
  (LEAGUE_TIME_ZONE), whatever time zone the server's clock uses. Matches that
  already have a file are skipped, so it never overwrites.
*/
const config = require('../config');
const season = require('../model/seasons').get();
const matches = require('../model/matches');
const { findCurrentWeek } = require('../lib/league-time');
const Match = matches.Match;

const weekOverride = process.argv[2];

// A week stays current until this hour on its match day.
const MATCH_CUTOFF_HOUR = 21; // 9pm

let current;

if (weekOverride) {
  current = season.weeks.find(week => week.n == weekOverride);
} else {
  // TODO: Don't assume that weeks are already sorted.
  current = findCurrentWeek(season.weeks, new Date(), config.LEAGUE_TIME_ZONE, MATCH_CUTOFF_HOUR);
}

if (!current) {
  console.error(weekOverride ?
    `No week ${weekOverride} in the season.` :
    'No upcoming week in the season. Pass a week number to spawn a specific week.');
  process.exit(1);
}

const { code, date } = current;

console.log('spawning', current);

current.matches
  // Filter to only matches not already created. Safety against overwrite.
  .filter(({match_key}) => !matches.get(match_key))
  .filter(info => (info.away_key!="BYE" && info.home_key!="BYE"))
  .map(info => {
    console.log(info);
    const away = season.teams[info.away_key];
    const home = season.teams[info.home_key];
    return new Match({
      key: info.match_key,
      name: `${code} ${info.away_key} @ ${info.home_key}`,
      week: current.n,
      date,
      venue: info.venue,
      away,
      home,
    });
  })
  .forEach(match => {
    // console.log(match);
    match.save();
  });
