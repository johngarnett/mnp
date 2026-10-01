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

- [x] **Manual point adjust** (`3605131`, `fc34983`) — an admin adds
  `point_adjust` to a match file for forfeits and suspended matches; a negative
  adjustment comes out of the bonus first when the bonus covers it. NESLP
  treats a missing value as 0 and skips mnp's round 5 scoring change (NESLP
  scores round 5 as a singles tiebreaker). See `docs/admin-tasks.md`.

## Accounts and security

- [x] **Signup hardening** (`9ca73ac`, `5b0433e`, `e49b8c0`, `f5ba033`) — block
  .ru/.de emails, require a first and last name without special characters (up
  to 50 characters), and require a daily PIN from the captain. NESLP changes:
  the PIN is the date as YYMMDD in `LEAGUE_TIME_ZONE` (default
  America/Los_Angeles) instead of the server's clock, and a rejected sign-up
  shows one generic error with the entered name and email kept.
- [x] **Player key remapping** (`275f3a3`) — a renamed player keeps their key
  through a name alias. NESLP reads aliases from the optional
  `DATA_FOLDER/player-name-aliases.json` (`{ "New Name": "Old Name" }`, restart
  after editing) instead of mnp's table in `lib/make-key.js`.

## Navigation and pages

- [x] **Admin editing of machines** (`9be307d`) — league admins (not just
  ROOT) can add and remove machines. NESLP also cleans machine codes on the
  server, ignores blank codes or names, and sizes the code box for phones.
- [ ] **External announcements** (`8d4c38f`, `76ddca1`) — load home-page
  announcements from `ANNOUNCEMENTS_TEMPLATE_URL` instead of editing
  `template/index.html`.

## Logging

- [x] **Richer POST logging** (`3243741`, `f237a44`, `b3c66ab`) — include match
  data, the lineups request path, and game report details in
  `middleware/postlog.js` log entries.

## Data and tools

- [x] **Per-season stats folder** (`35327e8`) — store player stats under
  `DATA_FOLDER/<season>/stats` instead of `DATA_FOLDER/stats`. NESLP also
  creates the folder when missing. Production needs `util/compute-stats.js`
  rerun (or `data/stats/*` moved into the season folder) after deploying.
- [x] **Roster export** (`bcf0c95`) — `importers/export-season.js` writes each
  team's current roster to `<season>/exported-rosters.csv` as `name,team,role`
  (C/A/P), the same format as `rosters.csv`. Purpose: capture end-of-season
  rosters, after in-season changes, as the starting point for next season's
  setup. NESLP fixes: the season argument now selects the season read (mnp only
  changed the output folder), and a missing season is reported instead of
  crashing.
- [ ] **Match results export** (`da8d658`) — admin script, run by hand. Deferred.
  `importers/export-season-matches.js` writes one row per match with each team's
  sub count, sub IPR, roster IPR, total IPR, points, bonus, and round 4 points.
  Purpose: mnp added it with its handicap (Aug 2025) to judge whether the
  handicap was fair. Only useful to NESLP as a general results export. Porting
  notes: it uses mnp's handicap bonus fields, crashes on missing matches, and has
  the same season-argument problem the roster export had.
- [ ] **CSV and report scripts** (`ab513c9`, `3126412`, `9a75eab`) — admin
  scripts, run by hand. Deferred.
  - `util/create_players_csv.js` lists every player account (name, key, signup
    date, verified) and counts names with trailing spaces. Purpose: account
    audits, such as unverified sign-ups and messy names.
  - `util/create_season_players_csv.sh` lists everyone who appeared in a match
    lineup, in one season or all, with the date they last played. Purpose: tell
    active players from lapsed ones; also the key-to-name lookup for the posts
    CSV.
  - `util/create_posts_csv.sh` turns the POST log (`data/posts`) into CSVs with
    names filled in: one of admin actions (machine, roster, venue edits) and a
    timeline per season of match activity (lineups, readies, picks, responses,
    score reports, confirmations). Purpose: settle disputes, see how long
    captains take to pick, and trace problems. Uses the richer POST logging
    ported earlier. The most useful of these tools for NESLP.
  - `util/team-ipr-avg.sh` averages each team's games-weighted IPR over weeks
    1-10. Purpose: mnp's playoff rules (L4.03.3d, L4.03.5) seed the B semifinals
    and finals by lowest average team IPR. Only relevant if NESLP adopts a
    similar rule; its ÷3 formula and weeks 1-10 are MNP-specific.
  - Porting notes: the shell scripts hardcode relative `../data` paths (use
    `DATA_FOLDER`), write to MNP-style `season-N` folders (NESLP's are `9`), and
    need `jq`, plus `pv` and Miller (`mlr`), which aren't installed here.
    `create_posts_csv.sh` creates its season folders with a grep that misses the
    log's pretty-printed JSON. It also reads away/home from mnp's
    `mnp-<season>-<week>-<away>-<home>` keys; NESLP's keys are
    `slp-<season>-<week>-<venue>-<home>-<away>`. `find -regex` with `+` fails on macOS.
- [x] **Signup folder** (`2b69837`) — save signups to `signups/account/` rather
  than a folder named after the submitted signup reason, which let a form post
  write files anywhere. The reason stays in the record.

## Last

Do these after everything else.

- [ ] **Report Player Conduct** (`ff7876a`) — conduct report form and
  confirmation templates.
- [ ] **Menu split and My Team** (`23b4dba`, `16451b9`) — split the nav bar
  into the main menu plus a PLAYER menu in the upper right (shows the player's
  first name when logged in), add "My Team", and expand the player profile
  page. The routes in `23b4dba` pass `playerFN` to every page for the new
  menu, and the "My Team" link in `16451b9` lives in the PLAYER menu.
