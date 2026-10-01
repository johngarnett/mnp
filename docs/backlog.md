# Backlog

Candidate changes to port from the MNP repo (remote `mnp`, `../mnp`) made since
NESLP diverged at mnp commit `2fc20d5` (2021-12-09). Bring changes in with
`git cherry-pick <hash>` or by hand; expect conflicts in `model/matches.js` and
`route/mnp.js` because of the Street League match-format changes. Each ported
change gets a test in `tests/` (see `docs/testing.md`).

## Bug fixes

- [x] **Picking resubmit error** (`2f0a369`) — check for errors properly when
  picking so refreshing the page after responding to picks doesn't trigger a
  form-resubmit error.
- [x] **IPR display fixes** (`62236ff`, `c90dd9f`, team-rating line of
  `7e52dbb`) — unknown players show a green "1" badge and count as IPR 1 in team
  totals on the team, match team, and pregame pages. `bdd0fd7` was skipped: it
  only fixes handicap functions that NESLP doesn't have.
- [x] **Player stats sort and week 0** (`7e758fb`, `7626759`) — sort player
  stats by week correctly and exclude week 0 from stats. The week 0 filter
  was adapted to `slp-` match keys.

## Scoring

- [ ] **Manual point adjust** (`3605131`, `fc34983`) — per-match point
  adjustment for forfeits and suspended matches; a negative adjustment is taken
  from the bonus first.

## Accounts and security

- [ ] **Signup hardening** (`9ca73ac`, `5b0433e`, `e49b8c0`, `f5ba033`) — block
  .ru/.de emails, limit username length, sanitize names (allowing accents and
  some symbols), don't create accounts for bogus names, and add a challenge
  question to the signup form.
- [ ] **Player key remapping** (`275f3a3`) — `lib/make-key.js` can map a
  player's name to an existing key so a renamed player keeps their key.

## Navigation and pages

- [ ] **Admin editing of machines** (`9be307d`) — allow league admins to edit
  the machines page.
- [ ] **Sorted pick lists** (`f9ba89d`) — sort machines and players in the
  picking and responding dropdowns.
- [ ] **External announcements** (`8d4c38f`, `76ddca1`) — load home-page
  announcements from `ANNOUNCEMENTS_TEMPLATE_URL` instead of editing
  `template/index.html`.

## Logging

- [ ] **Richer POST logging** (`3243741`, `f237a44`, `b3c66ab`) — include match
  data, the lineups request path, and game report details in
  `middleware/postlog.js` log entries.

## Data and tools

- [ ] **Per-season stats folder** (`35327e8`) — store player stats under
  `DATA_FOLDER/<season>/stats` instead of `DATA_FOLDER/stats`. Requires moving
  or recomputing existing stats files and updating `setupMNPFolders.sh`.
- [ ] **Season export tools** (`bcf0c95`, `da8d658`) — `importers/export-season.js`
  and `importers/export-season-matches.js` write rosters and match results to
  CSV. Strip out the handicap columns.
- [ ] **CSV and report scripts** (`ab513c9`, `3126412`, `9a75eab`) —
  `util/create_players_csv.js`, `util/create_posts_csv.sh`,
  `util/create_season_players_csv.sh`, and `util/team-ipr-avg.sh`. Update
  `mnp-` match-key patterns to `slp-`.
- [ ] **Signup folder** (`2b69837`) — save signups to `signups/account/` rather
  than a folder named after the signup reason.

## Last

Do these after everything else.

- [ ] **Report Player Conduct** (`ff7876a`) — conduct report form and
  confirmation templates.
- [ ] **Menu split and My Team** (`23b4dba`, `16451b9`) — split the nav bar
  into the main menu plus a PLAYER menu in the upper right (shows the player's
  first name when logged in), add "My Team", and expand the player profile
  page. The routes in `23b4dba` pass `playerFN` to every page for the new
  menu, and the "My Team" link in `16451b9` lives in the PLAYER menu.
