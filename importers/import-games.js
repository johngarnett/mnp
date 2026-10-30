const format = require('../lib/formats');
const scoring = require('../lib/scoring');

process.stdin.setEncoding('utf8');

function processLine(line) {
  var cols = line.split(',');
  if(cols.length < 6) return undefined;

  var game = {
    week: parseInt(cols[0]), //mnp. for any mnp only attributes.
    datestamp: parseInt(cols[1]),
    away: cols[2],
    home: cols[3],
    round: parseInt(cols[4]),
    machine: cols[5],
    players: [
      cols[6],cols[8],cols[10],cols[12]
    ],
    scores: [
      parseInt(cols[7]) || 0,
      parseInt(cols[9]) || 0,
      parseInt(cols[11]) || 0,
      parseInt(cols[13]) || 0
    ],
    reported: {
      away_points: parseInt(cols[14]) || 0,
      home_points: parseInt(cols[15]) || 0
    }
  };

  //Scored by the match format's round type (lib/formats, lib/scoring).
  var spec = format.roundSpec(game.round);
  if(!spec) {
    return undefined;
  }
  game.calculated = scoring.sidePoints(game.scores.slice(0, spec.playersPerGame), spec);

  return game;
}

process.stdin.on('data', function(chunk) {
//console.log("on(data), chunk: ",chunk);

  var lines = chunk.replace(/\r/g,'').split('\n');
  for(i in lines) {
    console.log("lines["+i+"]: ",lines[i]);
    var game = processLine(lines[i]);
    if(game) console.log(game);
  }
});

process.stdin.on('end', function() {
//console.log("on(end)");

});

