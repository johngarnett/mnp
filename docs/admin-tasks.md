# Admin tasks

What league admins can do on the website, and the data files and scripts used
on the server. Paths are relative to the data folder (`DATA_FOLDER`), and
`<season>` is the season folder (`CURRENT_SEASON`, for example `9`).

## Before running any script

Scripts read the same settings as the server. Run them from the project root
with `DATA_FOLDER` and `CURRENT_SEASON` set the way the `start` script sets
them. Otherwise `.env` makes them use `season-0`, which doesn't exist:

```sh
DATA_FOLDER=/path/to/data CURRENT_SEASON=9 node util/compute-stats.js
```

`node util/get-current-season-key.js` prints the `key` stored inside the season's
`season.json`. That key can differ from the folder name (for example `season-1`
in folder `9`).

## On the website

League admins are the player keys listed in `LEAGUE_ADMINS`.

- **Act as any team's captain in any match:** add or remove lineup players
  and set captains, mark a lineup ready and confirm the other lineup, make
  picks and responses, report and confirm scores, and change the match's
  machines.
- **Edit season rosters** on a team's page (add a player as P, A co-captain,
  or C captain, or remove one). Changes are saved to `<season>/season.json`.
  Matches that already exist keep the lineups they were created with.
- **Edit a venue's machine list** on the venue's page.
- **Edit the machine list** on the Machines page (codes are uppercase letters
  and digits).

League admins can also visit `/matches/reload` to reload every match file
from disk (see below).

The special `ROOT` account (player key `6143`) can also create venues and
create matches by hand.

Anyone, logged in or not, can download the current season's rosters from
`/rosters.csv`.

## Applying edits to data files

The server reads data files when it starts.

- After editing **match files**, visit `/matches/reload` while logged in as a
  league admin, or restart the server.
- After editing **anything else** (`player-name-aliases.json`, `venues.json`,
  `machines.json`, `season.json`, `IPR.csv`), restart the server.

## Adjust a match's points (forfeits, suspended matches)

Add `point_adjust` to the match file, `<season>/matches/<match key>.json`:

```json
"point_adjust": { "home_points": 0, "away_points": -2 }
```

- Positive values add points to the team's total.
- A negative value comes out of the team's participation bonus when the bonus
  covers it (the bonus shown drops), and otherwise out of its points.
- Leave a team's value at 0, or out, to leave it unchanged.

The adjusted totals are used everywhere points appear, including standings.

## Each week

- **Create the week's match files:** `node util/spawn-matches.js [week]`. With
  a week number, it creates that week's matches. Without one, it picks the first
  week whose match day hasn't reached 9 pm in the league's time zone
  (`LEAGUE_TIME_ZONE`, default America/Los_Angeles), whatever zone the server's
  clock uses. Matches that already have a file are skipped, so it never
  overwrites. Lineups come from the season rosters, captains from the season's
  captain and co-captain.
- **Keep venue machine lists current:** `node util/find-unknown-machines.js
  [week]` lists machines used in that week's matches that aren't on the venue's
  list (read-only). `node util/update-venues.js [week]` adds them to
  `venues.json`. Both stop with an error if a match file for the week is
  missing.
- **Recompute player stats:** `node util/compute-stats.js` rebuilds
  `<season>/stats` from the season's match files, leaving out week 0.

## Players and accounts

A player's key is made from their name, so a new name would separate them from
their account, stats, and match history. Two ways to handle a rename:

- **Keep the old key** (simplest): map the new name to the old one in
  `player-name-aliases.json`, then restart. Capitals and extra spaces don't
  matter. If the file has a JSON error, the server logs it and runs without
  aliases.

  ```json
  { "Robert Smith": "Bob Smith" }
  ```

- **Move the account to a new key:** `node util/rename-player.js "Old Name"
  "New Name"` moves the account, password, and sessions. It doesn't move stats
  or past match lineups. It stops if the new name already has an account or if
  an alias gives both names the same key.

Other account tools:

- `node util/gen-key.js "Name"` prints the key for a name (after aliases).
- `node util/find-sessions.js "Name"` lists a player's login sessions.
- `node util/destroy-player.js "Name"` permanently deletes an account and its
  password, with no confirmation. Stats and match history are left alone.
- `node util/migrate-keys.js <oldKey> ["New Name"]` moves one account by key
  (account and password only, not sessions).
- `node util/clean-pws.js` re-keys **every** account whose key doesn't match
  its name, moving passwords, tokens, and sessions. There is no dry run, and it
  doesn't update stats or matches; run `audit-players` first.
- `node util/sanitize-players.js` strips unexpected fields from every account
  file. It stops without changing anything if any file in `players/` isn't
  valid JSON.

## Checks (read-only)

- `node util/audit-players.js`: accounts whose key doesn't match their name, or
  with no IPR.
- `node util/audit-rosters.js`: rostered players with no IPR.
- `node util/audit-venues.js`: venue machines missing from `machines.json`.
- `node util/confirm-all.js`: rounds not confirmed by both captains. Despite
  the name, it doesn't confirm anything.

## Season files

- **Build `season.json`:** `node importers/import-season.js [season folder]
  [--number <n>]` reads comma-separated files (no header row) from
  `<season>/` and writes `<season>/season.json`:

  | File | Columns |
  |---|---|
  | `venues.csv` | venue key, venue name |
  | `teams.csv` | team key, home venue key, team name |
  | `rosters.csv` | player name, team key, role (C captain, A co-captain, P player) |
  | `matches.csv` | week, date (YYYYMMDD), away team, home team, venue |
  | `groups.csv` | group key, group name, team keys... (optional) |

  - Match keys are `slp-<number>-<week>-<venue>-<home>-<away>`. `--number`
    defaults to the folder name (season folder `9` with `--number 1` keeps
    the current season's keys, `slp-1-...`).
  - Weeks after `NUM_WEEKS` are playoffs and may use placeholder teams (`S1`-
    `S12`, `QF1`-`QF8`, `H45`, `H18`, `H36`, `H27`, `FN1`, `FN2`, `BR3`,
    `BR4`); weeks 91-93 are labeled Quarter Finals, Semi Finals, Finals &
    Bronze. Week `S` is a scrimmage.
  - Any other week (such as `0`) is a special event: put the hosting team in the
    away column and the text (HTML) to show in the home column.
  - Use `BYE` as a team for a bye week.
  - Without `groups.csv`, every team goes in one `target` group (the team page
    needs every team in a group). Divisions are always 0.
  - If any team, venue, or date is unknown, it lists every problem and doesn't
    write `season.json`.

  **Regenerating mid-season overwrites roster changes made on the team pages.**
  Export the rosters first (below) and use that file as `rosters.csv`.
- **Export current rosters:** `node importers/export-season.js [season]`
  writes `<season>/exported-rosters.csv` in the `rosters.csv` format above,
  including roster changes made on the team pages. Use it as the starting point
  for next season's `rosters.csv`.

## Unsupported

These came from Monday Night Pinball and don't work for NESLP as they are. Don't
run them without fixing them first.

- `util/gen-week.js`: older week generator; crashes on an undefined `SEASON`.
  Use `spawn-matches.js`.
- `util/correct-player-names.js`: renames accounts from a CSV but doesn't move
  passwords, so renamed players can't log in.
- `importers/import-ipr.js`: requires a missing module and a missing
  `playerinfo.json`.
- `importers/import-venues.js`: prints venues as a list, not the keyed format
  `venues.json` uses.
- IFPA tools: `importers/import-ifpa.js`, `util/update-ifpa.js`,
  `util/compare-ifpa.js`, `util/ifpa-report.js`. They need IFPA files that don't
  exist here, and `update-ifpa.js` fails on bugs in `model/ifpa.js`.
- `util/summarize-weeks.js`: only handles `mnp-` match keys.
- `util/fix-broken-matches.js`: a one-time repair for MNP season 10.
- `util/create-mock-week.js`, `util/create-scrimmage-week.js`: MNP test and
  scrimmage tools (bad file path; hardcoded `mnp-13` keys).
- `importers/import-games.js`, `import-grid.js`, `import-groups.js`,
  `import-skill-shot.js`: converted MNP's old spreadsheets.
- `util/update-stats.js`: replaced by `compute-stats.js`.
- `scripts/pre-week.sh`, `post-week.sh`, `restart.sh`, `sync-to-archive.sh`:
  MNP's server cron jobs (paths under `/home/mnp`, Node 6, MNP's service and
  archive). NESLP uses the `start` and `restart` scripts in the project root.
