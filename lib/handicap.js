/*
  The IPR handicap bonus, when the match format has one: a team whose players'
  ratings add up to less than settings.targetIpr gets (target - team IPR) /
  settings.divisor points, truncated and capped at settings.cap.

  teamIpr(lineup, maxPlayers) is the rating sum, with a short lineup filled
  in: fewer than maxPlayers players adds the average of the top three, and
  fewer than maxPlayers - 1 also adds the average of the next three.

  matchHandicap(lineup, format) is awarded once the match is played: for a
  full lineup where everyone played at least roundsForCredit rounds it uses the
  lineup's IPR; otherwise it uses the average IPR of the rounds actually
  played, scaled up to a full lineup. expected(lineup, format) is the pre-match
  preview from the lineup alone.
*/
const TOP_GROUP = 3;
const SECOND_GROUP = 6;
const MIN_IPR = 1;
const NO_HANDICAP = 0;

function iprForPlayer(player) {
  if (!player) return 0;
  const ipr = Number.isFinite(player.IPR) ? player.IPR : Number(player.rating);
  return Math.max(MIN_IPR, Number.isFinite(ipr) ? ipr : MIN_IPR);
}

function average(players) {
  return players.reduce((sum, p) => sum + iprForPlayer(p), 0) / players.length;
}

function teamIpr(lineup, maxPlayers) {
  const sorted = lineup.slice().sort((a, b) => iprForPlayer(b) - iprForPlayer(a));
  let total = sorted.reduce((sum, p) => sum + iprForPlayer(p), 0);

  if (sorted.length > 2 && sorted.length < maxPlayers) {
    total += average(sorted.slice(0, TOP_GROUP));
  }
  if (sorted.length > 5 && sorted.length < maxPlayers - 1) {
    total += average(sorted.slice(TOP_GROUP, SECOND_GROUP));
  }
  return total;
}

function clamp(handicap, settings) {
  return Math.min(settings.cap, Math.max(NO_HANDICAP, Math.trunc(handicap)));
}

function fromIpr(ipr, settings) {
  return clamp((settings.targetIpr - ipr) / settings.divisor, settings);
}

function expected(lineup, format) {
  if (!format.handicap.enabled) return NO_HANDICAP;
  return fromIpr(teamIpr(lineup, format.lineup.max), format.handicap);
}

function matchHandicap(lineup, format) {
  if (!format.handicap.enabled) return NO_HANDICAP;
  const maxPlayers = format.lineup.max;
  const roundsForCredit = format.participationBonus.roundsForCredit;
  const played = lineup.map(p => p.num_played || 0);
  const playerRounds = played.reduce((sum, n) => sum + n, 0);
  const everyoneCredited = played.every(n => n >= roundsForCredit);

  if (playerRounds === 0) return NO_HANDICAP;
  if (lineup.length === maxPlayers && everyoneCredited) {
    return fromIpr(teamIpr(lineup, maxPlayers), format.handicap);
  }
  const playedIpr = lineup.reduce((sum, p) => sum + (p.num_played || 0) * iprForPlayer(p), 0);
  return fromIpr((playedIpr * maxPlayers) / playerRounds, format.handicap);
}

module.exports = { iprForPlayer, teamIpr, expected, matchHandicap };
