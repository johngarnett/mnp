/*
  Renders a page inside template/base.html with the branding (title prefix,
  menus, footer) and the logged-in player's first name for the PLAYER menu.

  renderPage(reqOrUkey, vars, partials): reqOrUkey is the request (its
  req.user.key names the player), a player key, or null for an anonymous
  viewer. vars go to the template; partials usually hold {content}.
*/
const fs = require('fs');
const mustache = require('mustache');
const brand = require('./branding');
const players = require('../model/players');

const BASE_TEMPLATE = './template/base.html';
const ANON = 'ANON';
const DEFAULT_PLAYER_LABEL = 'PLAYER';

const base = fs.readFileSync(BASE_TEMPLATE).toString();

function playerKey(reqOrUkey) {
  if (!reqOrUkey) return ANON;
  if (typeof reqOrUkey === 'string') return reqOrUkey;
  return (reqOrUkey.user && reqOrUkey.user.key) || ANON;
}

function firstName(ukey) {
  const player = players.get(ukey);
  return player ? player.name.split(' ')[0] : DEFAULT_PLAYER_LABEL;
}

function renderPage(reqOrUkey, vars, partials) {
  return mustache.render(
    base,
    {
      brand,
      mainMenu: brand.mainMenu,
      playerMenu: brand.playerMenu,
      hasPlayerMenu: brand.hasPlayerMenu,
      playerFN: firstName(playerKey(reqOrUkey)),
      ...vars
    },
    partials
  );
}

module.exports = { renderPage };
