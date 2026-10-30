var fs = require('fs');
var util = require('../lib/util');
var CONST = require('../constants');
var players = require('./players');
var IPR = require('./ratings');
const config = require('../config');
const DATA_FOLDER = config.DATA_FOLDER;
const stem = DATA_FOLDER  + '/' + config.CURRENT_SEASON

// TODO: Refactor in conjunction with splitting venues.js
var venues = require('./venues');

//The match format (rounds, lineup limits, bonus, handicap, tie-breaker) is
//configuration: see lib/formats and docs/formats.md.
const format = require('../lib/formats');
const scoring = require('../lib/scoring');
const handicap = require('../lib/handicap');
//League matches are keyed <prefix>-<season>-<week>-...; the prefix is the branding's.
const LEAGUE_MATCH_KEY = new RegExp('^' + require('../lib/branding').matchKeyPrefix + '-\\d+-\\d+');

//The regular rounds of a new match. The tie-breaker round, for formats that
//have one, is added by confirmScores when the match is tied after the last
//regular round.
function makeRounds() {
  return format.rounds.map((spec, i) => makeRound(i + 1, spec));
}

function makeRound(n, spec) {
  var round = {
    n: n,
    games: []
  };

  for(var j = 0; j < spec.games; j++) {
    round.games[j] = { n: j+1 };
    //TODO: Move roundDone here as round.isDone
  }

  return round;
}

var _map = {};

// _myMatch maps user keys to match keys: (ukey -> key)

var _myMatch = {};

function getMatch(key) {
  var match = _map[key];
  if(!match) {
    //Let's try to load.
    match = loadMatch(key);
    if(match) {
      //Cache the match for faster access.
      _map[key] = match;
    }
  }
  return match;
}

function loadMatch(key) {
  let filename = `${stem}/matches/${key}.json`;
  if(!util.fileExists(filename)) { return; }
  console.log(filename);

  var json = JSON.parse(fs.readFileSync(filename));
  //How do we apply our prototype back to the loaded object.
  //First make an empty match
  var match = new Match({});
  //Now let's copy in the team values.
  util.copy(json.home, match.home);
  util.copy(json.away, match.away);
  //Copy the rest of the match, but don't re-overwrite the away and home teams.
  util.copy(json, match, ['home','away']);

  try {
     buildUserToMatchMap(json);
  } catch (e) {
     console.error('loadMatch: failed to build user-to-match mapping.', e);
  }
  return match;
}

// buildUserToMatchMap: builds a mapping from user key (ukey) to match key for all matches in the current season.
// This is used by /mymatch to take the user directly to their match.

function buildUserToMatchMap(match) {
   if (!match) {
      console.log('buildUserToMatchMap: null input match');
      return;
   }
   var key = match.key;
   var home = match.home && match.home.lineup;
   var away = match.away && match.away.lineup;

   if (!key || !home || !away || !match.date) {
      console.log('buildUserToMatchMap: malformed input match', match);
      return;
   }
   var date = new Date(match.date);
   var keyDate = {key, date};

   for (var i = 0; i < home.length; i++) {
      var ukey = home[i].key;

      if (isMyMatchStale(ukey, date)) {
        _myMatch[ukey] = keyDate;
      }
   }
   for (var j = 0; j < away.length; j++) {
      var vkey = away[j].key;

      if (isMyMatchStale(vkey, date)) {
        _myMatch[vkey] = keyDate;
     }
   }
}

function isMyMatchStale(key, date) {
   return (!_myMatch[key] || (_myMatch[key].date < date));
}

//TODO: This never really got used. Probably remove at some point.
function deleteMatch(key) {
  var filename = DATA_FOLDER + '/matches/'+key+'.json';
  if(util.fileExists(filename)) {
      //TODO: Move the file to the trash instead of just wiping it.
    fs.unlinkSync(filename);
  }
  delete _map[key];
}

//TODO: Q: It seems like some day we'll hit the memory wall
//	   on how much junk we can just load.
function loadAll() {
  console.log("loadAll()...");
  _map = {};

  var list = fs.readdirSync(stem + '/matches/');
  list.forEach(fileName => {
    var spot = fileName.indexOf('.json');
    var key = fileName.substring(0,spot);
    var m = loadMatch(key);
    if(m) {
      m.key = key; //Fixes when I copy matches without changing key.
      _map[key] = m;
      // console.log("list["+i+"]:",m.key);
    }
  })
}

//TODO: Do we need different find and findOne?
function listFind(list,query) { //TODO: callback
  if(!query || !list) return null;

  //For now, assuming query is an object with a single {prop: value} element
  var prop;
  var value;
  for(x in query) {
    if(prop) console.log("What the fuck? prop not null.");
    prop = x;
    value = query[x];
  }
  for(i in list) {
    var obj = list[i];

    if(obj && obj[prop] && obj[prop] == value) {
      return obj;
    }
  }
  return null;
}

//Records when a match step happened (Date.now(), like state_at) in
//obj.metrics, where obj is the match or one of its rounds:
//stampMetric(match, 'set', 'home') sets match.metrics.set.home, and
//stampMetric(round, 'picked') sets round.metrics.picked.
function stampMetric(obj, name, side) {
  if(!obj.metrics) obj.metrics = {};
  if(side) {
    if(!obj.metrics[name]) obj.metrics[name] = {};
    obj.metrics[name][side] = Date.now();
  }
  else {
    obj.metrics[name] = Date.now();
  }
}

function listGet(list,key) {
  if(!key || !list) return null;
  for(i in list) {
    //if(list[i].key.toLowerCase() == key.toLowerCase()) {
    if(list[i].key == key) {
      return list[i];
    }
  }
  return null;
}

function listAdd(list,p) {
  //TODO: We should probably check for all fields we expect/want.
  if(!p) return false;
  if(listGet(list,p.key)) return false;
  list.push(p);
}

function listRemove(list,key) {
  for(i in list) {
    var p = list[i];
    if(p && p.key == key) {
      list.splice(i,1);
      return p;
    }
  }
}

function isAuth(ukey,list) {
  if(ukey == CONST.ROOT) return true;
  for(i in list) {
    var p = list[i];
    if(p.key == ukey) {
      return true;
    }
  }
  return false;
}

function Team(params) {
  this.name = params.name;
  this.key = params.key;
  this.captains = [
    params.captain,
    params.co_captain
  ].filter(x => !!x).map(name => ({
    key: players.makeKey(name),
    name,
  }));
  this.lineup = (params.roster || []).map(({name}) => ({
    // This is a little band-aid to make spawning matches easier.
    // For example, it would be much easier to spawn a team vs team scrimmage.
    // TODO: We should use a non-hash key.
    key: players.makeKey(name),
    name,
    sub: false,
    num_played: 0,
    IPR: IPR.forName(name),
  }));
}

Team.prototype = {
  constructor: Team,
  /** Admins and captains can invite */
  hasCaptain: function(ukey) {
    var result = isAuth(ukey,this.captains);
    return result;
  },
  getPermissions: function(ukey) {
    var auth = isAuth(ukey,this.captains);
    return {
      canEdit: auth,
      canInvite: auth,
      canConfirm: auth,
      canRemove: auth,
      canJoin: ukey != 'ANON'
    }
  },
  //The participation bonus and handicap (lib/handicap.js) for this team.
  //Neither is awarded until every regular-round game has been played, so
  //getPoints passes whether that is the case.
  getBonus: function(allGamesPlayed) {
    var bonus = { participation: 0, handicap: 0 };
    if(!allGamesPlayed) return bonus;

    var rules = format.participationBonus;
    var credited = this.lineup.filter(p => (p.num_played || 0) >= rules.roundsForCredit).length;
    var forfeit = rules.forfeitOnIllegalSubstitution && this.illegalSubstitution;
    bonus.participation = forfeit ? 0 : (rules.byPlayersWithCredit[credited] || 0);
    bonus.handicap = handicap.matchHandicap(this.lineup, format);
    return bonus;
  },
};

function getDate(t) {
  var now = new Date(t || Date.now());
  var month = now.getMonth() + 1;
  if(month < 10) month = '0' + month;
  var day = now.getDate();
  if(day < 10) day = '0' + day;
  var year = now.getFullYear();
  return month + '/' +day+ '/' +year;
}

function Match(params) {
  this.key = params.key;
  this.name = params.name;
  // TODO: type is deprecated
  this.type = params.type || 'manual';
  this.week = params.week || 'Scrimmage';
  this.round = 1;
  this.create_at = Date.now();
  this.date = params.date || getDate();
  this.setState(params.state || CONST.PREGAME);
  var vk = params.venue ? params.venue.key ? params.venue.key : params.venue : null;
  var venue = vk ? venues.get(vk) : null;
  if(!venue) {
    venue = {
      key: 'venue-'+params.key,
      name: 'Venue for ' +params.name,
      machines: []
    };
  }
  else {
    //Make a copy.
    var ven = {
      key: venue.key,
      name: venue.name,
      machines: []
    };
    for(i in venue.machines) {
      ven.machines.push(venue.machines[i]);
    }
    venue = ven;
  }

  this.venue = venue;

  this.away = new Team(params.away || { name: "Away Team" });
  this.home = new Team(params.home || { name: "Home Team" });
  this.rounds = makeRounds();
  this.players = [];
}


Match.prototype = {
  constructor: Match,
  // --------------- REMOVE PLAYER ----------------------------
  remove: function(params,callback) {
    var callback = callback || function() {};
    console.log("remove():",params);
    var ukey = params.ukey;
    var team;
    if(params.team && params.team == 'home') team = this.home;
    if(params.team && params.team == 'away') team = this.away;

    var auth = (ukey == CONST.ROOT); //TODO: This line is not necessary.
    if(team) auth = isAuth(ukey,team.captains);

    if(!auth) { return callback("ERROR: " +ukey+ " not authorized to REMOVE players"); }
    var key = params.key;
    if(!key || key.length == 0) { return callback("ERROR: Can't remove nothing"); }
    //Is the player even in the list?

    //Q: Should we prevent captains from removing themselves?
    //A: Unless there is some confirm by the user, or a way to undo, I say we do prevent.
    if(key == ukey) { return callback("ERROR: Can't remove yourself"); }

    //TODO: Should we prevent a team from removing a player that
    //      has played at least 1 game? In that case, they should
    //      first add the replacement, if applicable, then swap,
    //      then remove....but that's a big pain.
    //    I suppose that it might be ok, it will just confuse
    //    the GUI, but perhaps not in a breaking way.

    if(team) {
      var x = listRemove(team.captains,key);
      var y = listRemove(team.lineup,key);
      team.ready = false;
      team.confirmed = false;
      if(y) return callback(null,y);
    }
    else {
      var y = listRemove(this.players,key);
      if(y) return callback(null,y);
    }
    return callback("ERROR: Did not find target to remove");
  },
  // ----------------- ADD PLAYER ---------------------------------
  add: function(params,callback) {
    var callback = callback || function() {};
    //console.log("add player...\n",params);
    var ukey = params.ukey;
    var team;
    if(params.team && params.team == 'home') team = this.home;
    if(params.team && params.team == 'away') team = this.away;

    var auth = (ukey == CONST.ROOT);
    if(team) auth = isAuth(ukey,team.captains);

    if(!auth) { return callback("ERR: " +ukey+ " not authorized to add players"); }
    var want_captain = params.want_captain ? true : false;
    var name = params.name;

    if(!name || name.length == 0) {
      return callback("ERROR: Cannot add nothing.");
    }

    // This is trying to figure out who the user is
    // and if they are the same as the person to be added.
    var who = players.get(ukey);
    if(!who) { return callback("ERR: No player exists for " +ukey); }
    var hash  = players.makeKey(name);
    var uhash = players.makeKey(who.name);

    var p;
    var query = { key: hash };

    if(team) {
      //Check the lineups.
      if(!p) p = listFind(this.away.lineup,query); //function(err,p)?
      if(!p) p = listFind(this.home.lineup,query);
    }
    else {
      p = listFind(this.players,query);
    }

    if(!p) p = players.getByName(name);

    if(!p) {
      //Person was not in the match, nor found by email or name.
      var player = {
        key: hash,
        name: name
      };
      p = player;
    }
    else {
      var player = {
        key: hash,
        name: p.name
      };
      p = player;
    }
    if(team) {
      //Determine if the player is a sub.

      // TODO: Fix any require race condition!
      var seasons = require('./seasons'); //Needed to delay the require.

      //console.log(seasons);
      // TODO: seasons.get() only gets current season. Should we compare against a season field in this?
      var season = seasons.get();
      //console.log(season);
      var teams = season.teams;
      var roster = teams[team.key] ? teams[team.key].roster : null;
      var isRoster = false;
      var isLeague = LEAGUE_MATCH_KEY.test(this.key);
      // console.log(this.key, isLeague, isRoster);
      if(roster) {
        for(x in roster) {
          var rp = roster[x];
          if(players.makeKey(rp.name) == p.key) {
            isRoster = true;
          }
        }
      }
      if(want_captain) {
        listAdd(team.captains,{
          key: p.key,
          name: p.name
        });
      }
      else {
        if(p.key != ukey) {
          listRemove(team.captains,p.key);
        }
        else {
          console.log("Suppressing removal of captain " +p.key+ " == " +ukey);
        }
      }
      // TODO: Why did I ever think listAdd was a good idea?
      listAdd(team.lineup,{
        key: p.key,
        name: p.name,
        sub: isLeague ? !isRoster : false,
        IPR: IPR.forName(p.name),
      });
      team.ready = false;
      team.confirmed = false;
    }
    else {
      listAdd(this.players,p);
    }
    this.save();
    callback(null,this);
  },
  // -------------- ADD MACHINE -------------------------------
  addMachine: function(params,callback) {
    console.log("addMachine()",params);
    var ukey = params.ukey;
    var auth = this.home.hasCaptain(ukey) ||
               this.away.hasCaptain(ukey);

    if(!auth) { return callback("ERROR: " +ukey+ " Not allowed to add machines."); }
    var mkey = params.mkey;
    var index = this.venue.machines.indexOf(mkey);
    if(index < 0) this.venue.machines.push(mkey);
    this.save();
    callback(null,this);
  },
  // ---------------  REMOVE MACHINE ------------------------------
  removeMachine: function(params,callback) {
    console.log("removeMachine()",params);
    var ukey = params.ukey;
    var auth = this.home.hasCaptain(ukey) ||
               this.away.hasCaptain(ukey);

    if(!auth) { return callback("ERROR: " +ukey+ " Not allowed to remove machines."); }
    var mkey = params.mkey;
    var index = this.venue.machines.indexOf(mkey);
    if(index >= 0) this.venue.machines.splice(index,1);
    this.save();
    callback(null,this);

  },
  // ------------------- CONFIRM LINEUP --------------------------
  confirmLineup: function(params,callback) {
    console.log("confirmLineup()...");
    console.log(params);
    var side = params.side || '';
    var ukey = params.ukey;
    var team;
    var vs;
    if(side == 'away') { team = this.away; vs = this.home; }
    if(side == 'home') { team = this.home; vs = this.away; }
    if(!team) { return callback("Choose which team's lineup to confirm."); }

    var auth = isAuth(ukey,team.captains);
    if(!auth) { return callback("Only a captain of " +team.name+ " can confirm the " +vs.name+ " lineup."); }

    var name = CONST.ROOT; //Default for the only one who isn't a captain here.
    var cap = listGet(team.captains,ukey);
    if(cap) name = cap.name;
    //The captain from {{side}} is confirming {{vs}} lineup.
    if(!vs.ready) { return callback("The " +vs.name+ " lineup isn't ready to be confirmed yet."); }
    vs.confirmed = {
      by: name,
      at: Date.now()
    };
    console.log("Confirmed: " +vs.name+ " by " +ukey);
    stampMetric(this, 'confirm', side);

    if(team.confirmed && team.ready) {
      //It's time for the match to move on to playing!
      this.setState(CONST.PICKING);
      this.round = 1;
    }
    this.save();
    if(callback) callback(null,this);
  },
  // -------------------- TEAM READY ------------------------------
  teamReady: function(params,callback) {
    console.log("teamReady()...");
    //console.log(params);
    var side = params.side || '';
    var ukey = params.ukey;
    var team;
    var vs;
    if(side == 'away') { team = this.away; vs = this.home; }
    if(side == 'home') { team = this.home; vs = this.away; }
    if(!team) { return callback("Choose which team's lineup to set."); }

    var auth = isAuth(ukey,team.captains);
    if(!auth) { return callback("Only a captain of " +team.name+ " can set its lineup."); }

    //TODO: Is the team in question actually ready to be ready?

    team.ready = true;
    stampMetric(this, 'set', side);
    this.save();
    if(callback) callback(null, this);
  },
  getRound: function(n) {
    var n = n || this.round;
    for(i in this.rounds) {
      var round = this.rounds[i];
      if(round.n == n) return round;
    }
    //TODO: Should we return undefined or null instead?
    return { n: 0, games: [] };
  },
  getGame: function(r,n) {
    var round = this.getRound(r);
    return round.games[n-1];
  },
  // ----------------- WHO PICKS/PLAYS FIRST? ------------------
  //[picking team, responding team] for a round; the picking team fills slots
  //1 and 3 of each game and the responding team slots 2 and 4.
  getOrder: function(round) {
    var spec = format.roundSpec(round || this.round);
    if(spec && spec.firstPick == 'home') return [this.home, this.away];
    return [this.away, this.home];
  },
  getPickingTeam: function(round) {
    var order = this.getOrder(round);
    if(this.state == CONST.PICKING) {
      return order[0];
    }
    if(this.state == CONST.RESPONDING) {
      return order[1];
    }
  },
  //Formats with lineup.truncateGamesToLineup drop games a short lineup can't
  //fill, so a 4-player team plays 4 singles instead of 5. Applies while the
  //round is being picked.
  truncateGamesIfNeeded: function(r) {
    if(!format.lineup.truncateGamesToLineup || this.state != CONST.PICKING) return;
    var round = this.getRound(r);
    var spec = format.roundSpec(round.n);
    if(!spec) return;
    var smaller = Math.min(this.away.lineup.length, this.home.lineup.length);
    var playable = Math.floor(smaller / (spec.playersPerGame / 2));
    if(playable < round.games.length) {
      round.games.splice(playable);
    }
  },
  // ------------------ MAKE PICKS -------------------------
  makePicks: function(params,callback) {
    console.log('makePicks', params);
    //Verify that the incoming picks are from the valid state.
    var st = params.state;
    if(!st || st != this.state) {
      return callback("ERROR: Not allowed to pick state " +this.state+ " from " +st);
    }
    var rnd = params.round;
    if(!rnd || rnd != this.round) {
      return callback("ERROR: Not allowed to pick round " +this.round+ " from " +rnd);
    }

    //console.log("makePicks() ", params);
    var team = this.getPickingTeam();
    if(!team) {
      //Probably should never happen.
      return callback(["ERROR: Not in a picking state"]);
    }

    if(!isAuth(params.ukey, team.captains)) {
      return callback(["ERROR: " +params.ukey+ " not authorized to pick"]);
    }
    else {
      //At this point, the ukey is a captain of the "picking"
      //team, and posting picks for this.round and this.state.
      // TODO: Seems like a bad idea to automatically write to the actual games objects.
      this.truncateGamesIfNeeded(this.round);
      var games = this.getRound().games;
      for(prop in params.picks) {
        var x = params.picks[prop];
        if(x.length > 0) {
          var nn = prop.split('.');
          var num = nn[1];
          var game = games[num - 1]; //Can also be checked against each game.n
          var field = nn[0];
          //TODO: assert field in valid_fields

          //Q: Is it possible to have multiple Forfeit players?
          game[field] = x;
        }
      }
      var numPlayers = format.roundSpec(this.round).playersPerGame;

      //Determine if picks are satisfied.
      var picksReady = true;
      var players = [[],[]];
      var machines = [];
      var errors = [];

      var addPlayer = function(n,p) {
        if(!p || p.length == 0) return false;
        var w = 1 - (n % 2);
        if(players[w].indexOf(p) >= 0) {
          errors.push("Cannot use same player for more than 1 game per round. " +p.name);
          return false;
        }
        players[w].push(p);
        return true;
      };

      var addMachine = function(m) {
        if(!m || m.length == 0) return false;
        // if(machines.indexOf(m) >= 0) {
        //console.log("Duplicate Machine: " + m);
          //TODO: The following is only an error if there are enough machines.
          //      We would need to pull up the venue and see what machines are in.
          //      BUT, just like we have virtual team objects for every match,
          //      we should have a virtual venue object to allow the match
          //      creator/director to remove games.
          //      Games that need to be added can also copy to other instances of
          //      the venue, including the master copy, but that might need review.
          // errors.push("Cannot use same machine for more than 1 game per round. " +m);
          // return false;
        // }
        machines.push(m);
        return true;
      };

      // ++++++++++ Regular round logic ++++++++++++++++
      for(var i = 0; i < games.length; i++) {
        var g = games[i];
        //Verify picking team picks.
        if(!addMachine(g.machine)) picksReady = false;
        if(!addPlayer(1,g.player_1)) picksReady = false;
        if(numPlayers > 2) {
          if(!addPlayer(3,g.player_3)) picksReady = false;
        }
        if(this.state == CONST.RESPONDING) {
          //Verify responding team picks.
          if(!addPlayer(2,g.player_2)) picksReady = false;
          if(numPlayers > 2) {
            if(!addPlayer(4,g.player_4)) picksReady = false;
          }
        }
      }

      console.log("state:",this.state,"picksReady:",picksReady);

      if(this.state == CONST.PICKING) {
        if(picksReady) {
          stampMetric(this.getRound(), 'picked');
          this.setState(CONST.RESPONDING);
        }
      }
      else if(this.state == CONST.RESPONDING) {
        if(picksReady) {
          stampMetric(this.getRound(), 'responded');
          this.setState(CONST.PLAYING);
        }
      }

      this.save();
      if(callback) callback(errors,this);
      else if(errors && errors.length > 0) throw new Error(JSON.stringify(errors));
    }
  },
  // ----------------- GET POINTS --------------------------
  //TODO: Consider rename getPoints -> getBoxscore
  // TODO: The only way that coundGames() is called is through getPoints. That seems kind of whack.
  //Totals from the regular rounds plus bonus and any point_adjust. The
  //tie-breaker round, when played, is reported separately in points.tieBreaker
  //and settles the result (see getResult) without counting in the totals.
  getPoints: function() {
    countGames(this);
    var points = { home: 0, away: 0, rounds: [], tieBreaker: null };
    var allGamesPlayed = true;
    for(var r = 0; r < format.regularRounds; r++) {
      var tally = tallyRound(this.getRound(r + 1));
      if(!tally.done) allGamesPlayed = false;
      points.rounds[r] = { n: r+1, home: tally.home, away: tally.away };
      points.home += tally.home;
      points.away += tally.away;
    }
    if(format.tieBreakerRound) {
      var tieBreaker = this.getRound(format.tieBreakerRound);
      if(tieBreaker.n) {
        var tb = tallyRound(tieBreaker);
        points.tieBreaker = { n: tieBreaker.n, home: tb.home, away: tb.away };
      }
    }
    var hbonus = this.home.getBonus(allGamesPlayed);
    var abonus = this.away.getBonus(allGamesPlayed);
    var adjust = this.point_adjust || {};
    var home = applyPointAdjust(adjust.home_points, hbonus.participation + hbonus.handicap);
    var away = applyPointAdjust(adjust.away_points, abonus.participation + abonus.handicap);
    points.bonus = {
      home: hbonus,
      away: abonus,
    };
    points.home += home.bonus + home.points;
    points.away += away.bonus + away.points;
    return points;
  },
  //True when the regular-round totals (with bonus and adjustments) are equal.
  isTied: function() {
    var points = this.getPoints();
    return points.home == points.away;
  },
  //'home', 'away' or 'tie' once the match is done, otherwise null. A tie after
  //the regular rounds is settled by the tie-breaker round when the format has one.
  getResult: function() {
    if(!this.isDone()) return null;
    var points = this.getPoints();
    var home = points.home;
    var away = points.away;
    if(home == away && points.tieBreaker) {
      home = points.tieBreaker.home;
      away = points.tieBreaker.away;
    }
    if(home > away) return 'home';
    if(away > home) return 'away';
    return 'tie';
  },
  canReport: function(params) {
    var ukey = params.ukey;

    //For now, and to test an easy hack...
    if(ukey == CONST.ROOT) return true;

    var r = params.round;
    var n = params.n;

    //DONE: if(ukey is ROOT)
    //TODO: if(ukey is a captain)
    //TODO: else if(ukey is a player)
    if(this.state != CONST.PLAYING) {
      //For non-captain players, return false
      //For captains, when can you change things?
      return false;
    }

    if(r != this.round) {
      console.log("Cannot report round " +r+ " during round " +this.round);
      return false;
    }

    //Q: Who can edit a game?
    //A: Any player from either team, for now.
    var list = [];
    for(i in this.home.lineup) {
      list.push(this.home.lineup[i]);
    }
    for(i in this.away.lineup) {
      list.push(this.away.lineup[i]);
    }
    var auth = isAuth(ukey,list);
    return auth;
  },
  reportScores: function(params,callback) {
    console.log("reportScores(): ",params);
    var ukey = params.ukey;
    var r = params.round;
    var n = params.n;
    var update = params.update;

    var round = this.getRound(r);
    var games = round.games;
    var game = games[n-1];

    //Q: When can a game be edited?
    //A: For now, anytime that r <= this.round
    //A2: Changing to only be r == this.round.
    if(r > this.round) {
      return callback("ERROR: Trying to edit a round that has not happened yet.");
    }

    var auth = this.canReport(params);
    if(!auth) {
      return callback("ERROR: " +ukey+ " not authorized to report scores.");
    }

    //TODO: There is a reported/observed bug where photos lose their
    //      transform data.
    var rot   = parseInt(update.photo_rotation || 0);
    var dx    = parseInt(update.photo_dx       || 0);
    var dy    = parseInt(update.photo_dy       || 0);
    var scale = parseFloat(update.photo_scale  || 1);
    rot = rot % 360;

    var data = update.photo_data;
    if(data && data.length > 0) {
      var purl = '/pics/' +data;
      if(!game.photos) game.photos = [];
      game.photos.splice(0,0,{
        uploaded_by: ukey,
        url: purl,
        rot: rot,
        scale: scale,
        dx: dx,
        dy: dy
      });
    }
    else {
      var oldPhoto = game.photos ? game.photos[0] : null;
      //Only update the oldPhoto if transform data was received.
      //We only need to check for one because they are sent as
      //a bundle.
      if(oldPhoto && update.photo_rotation) {
        oldPhoto.rot = rot;
        oldPhoto.scale = scale;
        oldPhoto.dx = dx;
        oldPhoto.dy = dy;
      }
    }

    //Just to be safe, we'll always say there is a mod.
    //var modified = false;
    //NOTE: We are sucking in whatever gets posted.
    //      This is pretty bad design because people
    //      could post all sorts of weird shit.
    //  BUT: For now, it's pretty convenient for changing
    //      players and/or the machine.
    for(prop in update) {
      var x = update[prop];
      if(prop.indexOf('photo_') != 0 && x.length > 0) {
        if(prop.indexOf('score_') == 0) {
          var newScore = parseInt(x);
          if(newScore > 0) game[prop] = newScore;
        }
        else {
          //TODO: Block non-captain access for non-score values.
          //      ie a change in machine or players.
          game[prop] = x;
        }
      }
    }

    //TODO: if(!modified)
    delete round.left_confirmed;
    delete round.right_confirmed;

    //TODO: Need break it all down into events that get logged, instead of full match saves?

    //TODO: If any scores were changed to 0 after calcPoints was
    //      called, the points and sums are not cleared.
    if(gameDone(game, r)) {
      calcPoints(game, r);
      //When the completed game was last saved (each save of a complete game
      //moves it on, so it ends up as the final save). For reports; not shown.
      game.complete_at = Date.now();
    }
    else {
      game.points_1 = 0;
      game.points_2 = 0;
      game.points_3 = 0;
      game.points_4 = 0;
      game.points_13 = 0;
      game.points_24 = 0;
      game.score_13 = 0;
      game.score_24 = 0;
    }

    var done = roundDone(round);
    //Timing for the round in play: the score confirmations just cleared above,
    //and when its last game was entered. (Scores can be changed but not
    //removed, so a finished round stays finished.)
    if(r == this.round && this.state == CONST.PLAYING) {
      if(round.metrics) delete round.metrics.confirmed;
      if(done && !(round.metrics && round.metrics.completed)) {
        stampMetric(round, 'completed');
      }
    }

    if(done) {
      //Check to see if the match is done?
      // if(r == this.round) {
      //   this.setState(CONST.REVIEWING);
      // }
    }
    else {
      //We don't need to change round or state, since we are
      //still waiting for more results. However, if the
      //game is complete, we can calculate the points.
    }

    //Save changes to the match and callback.
    this.save();
    if(callback) callback(null,this);
  },
  confirmScores: function(params,callback) {
    console.log("confirmScores():",params);
    var ukey = params.ukey;
    var order = this.getOrder();
    var left = order[0];
    var right = order[1];

    // var right = this.round % 2 == 0 ? this.away : this.home;
    // var left  = this.round % 2 == 0 ? this.home : this.away;

    var side = params.side;
    //Q: Is it really time to confirm?
    var round = this.getRound();
    if(roundDone(round)) {
      //Yes, this round can be confirmed.
      //Q: Is this the correct captain?
      if(side == 'left') {
        if(left.hasCaptain(ukey)) {
          var lcap = listGet(left.captains,ukey);
          var name = lcap ? lcap.name : ukey;
          round.left_confirmed = {
            by: name,
            at: Date.now(),
            elapsed: function() {
              return Date.now() - this.at;
            }
          };
          stampMetric(round, 'confirmed', left === this.home ? 'home' : 'away');
        }
        else {
          return callback("Only a captain of " +left.name+ " can confirm for " +left.name+ ".");
        }
      }
      else if(side == 'right') {
        if(right.hasCaptain(ukey)) {
          var rcap = listGet(right.captains,ukey);
          var name = rcap ? rcap.name : ukey;
          round.right_confirmed = {
            by: name,
            at: Date.now(),
            elapsed: function() {
              return Date.now() - this.at;
            }
          };
          stampMetric(round, 'confirmed', right === this.home ? 'home' : 'away');
        }
        else {
          return callback("Only a captain of " +right.name+ " can confirm for " +right.name+ ".");
        }
      }
    }
    else {
      //No, this round cannot yet be confirmed.
      return callback("This round can't be confirmed until all of its scores are entered.");
    }
    if(round.left_confirmed && round.right_confirmed) {
      //console.log("Round has been mutually confirmed!");

      if(this.round < format.regularRounds) {
        this.round++;
        this.setState(CONST.PICKING);
      }
      else if(this.round == format.regularRounds && format.tieBreaker && this.isTied()) {
        this.rounds.push(makeRound(format.tieBreakerRound, format.tieBreaker));
        this.round = format.tieBreakerRound;
        this.setState(CONST.PICKING);
      }
      else {
        this.setState(CONST.COMPLETE);
      }
    };
    this.save();
    if(callback) callback(null,this);
  },
  /** Method to see if a match is complete. */
  isDone: function() {
    if(this.state == CONST.COMPLETE) return true;
    if(this.round < format.regularRounds) return false;
    //The last round's scores are all in (confirmation may still be pending).
    if(!this.getRound().done) return false;
    if(format.isTieBreaker(this.round)) return true;
    return !(format.tieBreaker && this.isTied());
  },
  save: function() {
    var json = JSON.stringify(this,null,2);
    fs.writeFileSync(`${stem}/matches/${this.key}.json`,json);
  },
  setState: function(s) {
    this.state = s;
    this.state_at = Date.now();
  }
};

//Home and away points scored in a round, and whether all its games are done.
function tallyRound(round) {
  var tally = { home: 0, away: 0, done: true };
  for(var i = 0; i < round.games.length; i++) {
    var g = round.games[i];
    if(!g.done) tally.done = false;
    tally.home += g.home_points || 0;
    tally.away += g.away_points || 0;
  }
  return tally;
}

//Manual point adjustment for forfeits and suspended matches. An admin adds it
//to the match file, then reloads the matches:
//  "point_adjust": { "home_points": 0, "away_points": -2 }
//A negative adjustment comes out of the team's bonus when the bonus covers
//it, otherwise out of its points. A missing value counts as 0.
function applyPointAdjust(adjust, bonus) {
  var amount = Number(adjust) || 0;
  if(amount < 0 && amount + bonus >= 0) {
    return { bonus: bonus + amount, points: 0 };
  }
  return { bonus: bonus, points: amount };
}

function calcPoints(game, r) {
  var spec = format.roundSpec(r);
  if(!spec) return undefined;
  return scoring.scoreGame(game, spec);
}

function countGames(match) {
  // console.log("countGames... for " +match.key);
  var map = {};
  var incr = function(key) {
    var x = map[key] || 0;
    map[key] = x + 1;
  }
  //Games played in the regular rounds; the tie-breaker doesn't count.
  for(i in match.rounds) {
    var round = match.rounds[i];
    var spec = format.roundSpec(round.n);
    if(!spec || format.isTieBreaker(round.n)) continue;
    for(j in round.games) {
      var game = round.games[j];
      if(game.done) {
        for(var slot = 1; slot <= spec.playersPerGame; slot++) {
          incr(game['player_' + slot]);
        }
      }
    }
  }
  // console.log(map);
  for(i in match.away.lineup) {
    var p = match.away.lineup[i];
    var x = map[p.key] || 0;
    p.num_played = x;
    if (x == 2) {
      console.log("Player with only 2 rounds: ", p);
    }
  }
  for(i in match.home.lineup) {
    var p = match.home.lineup[i];
    var x = map[p.key] || 0;
    p.num_played = x;
    if (x == 2) {
      console.log("Player with only 2 rounds: ", p);
    }
  }
  // console.log(match.away.key,match.away.lineup);
  // console.log(match.home.key,match.home.lineup);
}

function roundDone(round) {
  console.log("roundDone() round:",round);
  var games = round.games;
  var done = true;
  for(var i = 0; i < games.length; i++) {
    if(!gameDone(games[i], round.n)) {
      done = false;
    }
  }
  round.done = done;
  return done;
}

function gameDone(game, r) {
  var spec = format.roundSpec(r);
  var scoresNeeded = spec ? spec.playersPerGame : 2;
  var done = true;
  for(var slot = 1; slot <= scoresNeeded; slot++) {
    var score = game['score_' + slot];
    if(!score || score.length == 0) {
      done = false;
    }
  }
  game.done = done;
  console.log("done: ", done);
  return done;
}

loadAll();

function get(key) {
   var match = _map[key];

   if(!match) {
     //Let's try to load.
     match = loadMatch(key);
     if(match) {
       //Cache the match for faster access.
       _map[key] = match;
     }
   }
   return match;
}

module.exports = {
  Match,
  //TODO: Should probably add callbacks to get and all.
  // uget: get match by user key
  uget: function(ukey) {
     var key = _myMatch[ukey] && _myMatch[ukey].key;

     if (!key) {
        return undefined;
     } else {
        return get(key);
     }
  },
  get: function(key) {
     return get(key);
  },
  all: function() {
    var list = [];
    for(k in _map) {
      list.push(_map[k]);
    }
    return list;
  },
  create: function(params,callback) {
    var ukey = params.ukey;
    if(ukey != CONST.ROOT) {
      return callback("ERROR: " +ukey+ " not authorized to create a match");
    }
    var match = new Match(params);
    _map[match.key] = match;
    match.save(); //TODO: add callback function
    callback(null,match);
  },
  remove: function(params,callback) {
    var ukey = params.ukey;
    if(ukey != CONST.ROOT) {
      return callback("ERROR: " +ukey+ " not authorized to remove a match");
    }
    var key = params.key;
    var match = this.get(key);
    if(!match) { return callback("ERROR: No match found for key=" +key); }
    deleteMatch(key);
    callback(null,match);
  },
  reload: function() {
    loadAll();
  }
  //Team: Team,
};

