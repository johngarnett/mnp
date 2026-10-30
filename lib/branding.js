/*
  The league's branding, read once at startup from BRANDING_FOLDER (a checkout
  of the league's branding repo; branding/example in this repo shows the
  layout and is the default). docs/branding.md describes the folder.

  league.json fields:
      name, shortName, titlePrefix   the league's names; titlePrefix heads every page title
      copyright                      footer text after the copyright sign (optional)
      timeZone                       IANA zone for clock times on the match pages
      matchKeyPrefix                 first part of league match keys, e.g. "mnp" in mnp-24-3-AAA-BBB
      publicUrl                      the site's address for links in emails (PUBLIC_URL overrides)
      contactEmail                   shown on pages that tell players how to reach the league
      conductEmail                   where player-conduct reports are sent (optional)
      emailName, emailSubjects       sender name and {verify, forgotPassword} subjects (optional)
      mainMenu                       [{label, href, redirect?}] for the upper-left menu
      playerMenu                     [{label, href}] for the upper-right PLAYER menu, or null for none
      pages                          {name: file} overrides for pages/ (optional)

  Folders: pages/ (home page and content pages), email/ (verify.html,
  forgotpass.html), static/ (icon_128.png, favicon.ico, brand.css and other
  files served at the site root ahead of the app's own static files).
*/
const config = require('../config');
const load = require('./load-branding');

module.exports = load(config.BRANDING_FOLDER);
