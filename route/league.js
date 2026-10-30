const express = require('express');
const router = express.Router();
const fs = require('fs');

const HTTP_NOT_FOUND = 404;

// TODO: This router is too big. There should be a closer 1:1 relationship with models.

const venues = require('../model/venues');
const seasons = require('../model/seasons');
const matches = require('../model/matches'); //For standings
const players = require('../model/players');
const stats = require('../model/stats');
// const ifpa = require('../model/ifpa');
const IPR = require('../model/ratings');
const { nameForKey } = require('../lib/all-names');
const { renderPage } = require('../lib/render');
const brand = require('../lib/branding');
const pages = require('../lib/content-pages');

//The content pages (home page, rules, ...) come from the branding folder, and
//are refreshed from BRANDING_URL when it is set; see lib/content-pages.js.
function sendPage(name, title) {
  return function(req, res) {
    res.send(renderPage(req, { title: title }, { content: pages.get(name) }));
  };
}

router.get('/', sendPage('index', 'Home'));
router.get('/leaguerules', sendPage('leaguerules', 'League Rules'));
router.get('/matchrules', sendPage('matchrules', 'Match Rules'));
router.get('/ratings', sendPage('ratings', 'Ratings'));
router.get('/newplayers', sendPage('newplayers', 'New Players'));
router.get('/handicapping', sendPage('handicapping', 'Handicapping'));
router.get('/new-teams', sendPage('new-teams', 'Call For Teams'));

//The scoresheet PDF, when the branding provides one.
router.get('/scoresheet',function(req,res) {
  res.sendFile(brand.staticFile('scoresheet.pdf'), function(err) {
    if(err) res.status(err.statusCode || HTTP_NOT_FOUND).send('No scoresheet for this league.');
  });
});

router.get('/standings',function(req,res) {
  //TODO: Accept a season number.
  const template = fs.readFileSync('./template/standings.html').toString();

  const season = seasons.get(); //TODO Allow other seasons.

  const divs = season.getStandings(); // { '1': [], '2': [] }
  var groupNames = new Array();
  var groupKeys = new Array();
  for (const [key, value] of Object.entries(season.groups)) {
    groupNames.push(value.name);
    groupKeys.push(key);
  }

  const divisions = Object.keys(divs).map(tier => ({
    tier,
    rows: divs[tier],
    groupName: groupNames[tier],
    groupKey: groupKeys[tier]
  }));

  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Standings',
    divisions
  },{
    content: template
  });

  res.send(html);
});

router.get('/schedule',function(req,res) {
  const template = fs.readFileSync('./template/schedule.html').toString();
  const season = seasons.get(); //TODO Allow other seasons.

  const weeks = season.weeks;

  //TODO: Q: Where and when do we add results to the weeks?

  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Schedule',
    weeks: weeks
  },{
    content: template
  });

  res.send(html);
});

router.get('/stats',function(req,res) {
  const template = fs.readFileSync('./template/stats.html').toString();
  const all = stats.all();

  /*
   * We no longer want or need stats broken out by division.  However, the
   * compute-stats.js does the stats and breaks them down by division.  We
   * don't want to have to touch/test THAT script just yet.  So we'll keep
   * the knowledge that there are multiple 'divisions' of stats.  And we
   * will just grab the 'all' stats.
   */

  const divs = all.reduce((divs, player) => {
    const pDivs = {'all': player.divisions['all']};
    if(!pDivs){
      return {};
    }
    const { name, key } = player;
    const rating = IPR.forName(name) || 0;

    Object.keys(pDivs).forEach(divId => {
      divs[divId] = divs[divId] || [];
      divs[divId].push(
        Object.assign({}, pDivs[divId], { name, key, rating })
      );
    });
    return divs;
  }, {});

  const divisions = Object.keys(divs).map(divId => {
    const list = divs[divId];
    const players = list.filter(p => p.num_matches > 0);

    const max = players.reduce((max, p) => {
      return Math.max(p.num_matches, max);
    }, 0);

    const cut = Math.round(max * 0.4);

    players.sort((a, b) => {
      if(a.num_matches < cut && b.num_matches >= cut) return 1;
      if(b.num_matches < cut && a.num_matches >= cut) return -1;
      if(a.pops > b.pops) return -1;
      if(b.pops > a.pops) return 1;
      return 0;
    });

    for(let i = 0; i < players.length; i++) {
      players[i].n = i + 1;
    }

    return {
      id: divId,
      players
    };
  });

  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Stats',
    divisions
  }, {
    content: template
  });
  res.send(html);
});

router.get('/ifparules', function(req,res) {
  res.redirect('https://www.ifpapinball.com/wp/wp-content/uploads/2020/12/PAPA_IFPA-Complete-Competition-Rules-1.pdf');
});

router.get('/conduct',function(req,res) {
  const template = fs.readFileSync('./template/conduct.html').toString();
  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Report Player Conduct',
  },{
    content: template
  });
  res.send(html);
});

//TODO: This function can be handled with Numeral on the client side.
function format(num) {
  if(Math.round(num) == num) {
    num += 0.000000001;
  }
  let str = num + ' ';
  if(str.length > 5) {
    str = str.substring(0,5);
  }
  str = str.trim();
  while(str.length < 5) {
    str = str + '0';
  }
  return str;
}

// TODO: This route seems like a huge security hole, but it is a
//       convenient way to lookup a player key by name.
router.get('/players',function(req,res) {
  const template = fs.readFileSync('./template/players.html').toString();

  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Players',
    players: players.all()
  },{
    content: template
  });

  res.send(html);
});

router.get('/rosters.csv',function(req,res) {
  // Get all the players on teams in the current season.
  // TODO: Ideally, you could get rosters at any week of any season.
  const {teams} = seasons.get();

  res.type('text/csv');

  res.send(
    Object.keys(teams).reduce((list, tk) => {
      return [
        ...list,
        ...teams[tk].roster.map(p => ([
          p.name,
          tk,
          // Determine player role
          teams[tk].captain === p.name ? 'C' :
          teams[tk].co_captain === p.name ? 'A' :
          'P',
          // TODO: legacy playerdb.csv includes IFPA # and division
        ].join(','))),
      ];
    }, [])
    .sort()
    .join('\n')
  );
});

router.get('/players/:key',function(req,res) {
  const template = fs.readFileSync('./template/player.html').toString();
  // var p = players.get(req.params.key);
  // //TODO: Need something different than using players == users.
  // if(!p) { return res.redirect('/players'); }

  const { key } = req.params;
  const fullStats = stats.get(key);
  const name = fullStats.name || nameForKey[key];

  //TODO: Might be nice to have team mapped.
  const st = fullStats.divisions.all;
  const ukey = req.user.key || 'ANON';
  const html = renderPage(req, {
    title: 'Player',
    name,
    num_matches: st.num_matches,
    points_won: st.points.won,
    ppm: st.ppm,
    pops: st.pops,
    // ifpa_rank: ifpa.rank(name) || 'Unknown',
    ipr: IPR.forName(name) || 'Unknown',
    // TODO: fullStats.history might be a case for moving history into divisions
    history: fullStats.history.sort((a, b) => a.week - b.week)
  },{
    content: template
  });
  res.send(html);
});

module.exports = router;
