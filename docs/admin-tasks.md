# Admin tasks

Tasks done by editing data files or running scripts on the server. Paths are
relative to the data folder (`DATA_FOLDER`), and `<season>` is the season folder
(`CURRENT_SEASON`, for example `9`).

The server reads matches, aliases, and other data when it starts, so **restart
the server after editing a data file**.

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

## Keep a renamed player's account and history

A player's key is made from their name, so a new name would separate them from
their account, stats, and match history. Map the new name to the old one in
`player-name-aliases.json`:

```json
{ "Robert Smith": "Bob Smith" }
```

Capitals and extra spaces don't matter. If the file has a JSON error, the server
logs it and runs without aliases.

To move the account to a key made from the new name instead, use
`node util/rename-player.js "Old Name" "New Name"`.

## Export end-of-season rosters

```sh
node importers/export-season.js [season]
```

Writes `<season>/exported-rosters.csv` as `name,team,role` (C captain,
A co-captain, P player), the format `rosters.csv` uses, as a starting point for
the next season.

## Recompute player stats

```sh
node util/compute-stats.js
```

Rebuilds `<season>/stats` from the season's match files, leaving out week 0.
Run it with the same `DATA_FOLDER` and `CURRENT_SEASON` as the server.
