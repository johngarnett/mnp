# Monday Night Pinball

## Summary

As of January 23rd, 2018, the MNP main codebase is now open source, under Gnu Public License (GPL).
Visit the live site at: [https://www.mondaynightpinball.com](https://www.mondaynightpinball.com)

The server runs any league: the match rules, the league's branding and the way
it is deployed are three separate settings.

| Setting | Values | Docs |
|---|---|---|
| `MATCH_FORMAT` | `ten-player` (MNP, default) or `five-player`; one file per format in `lib/formats/` | [docs/formats.md](docs/formats.md) |
| `BRANDING_FOLDER`, `BRANDING_URL`, `PUBLIC_URL` | a checkout of the league's branding repository (names, menus, home page, rules pages, emails, icons); `branding/example` by default | [docs/branding.md](docs/branding.md) |
| `TLS`, `PORT`, `TRUST_PROXY` | `TLS=internal` serves HTTPS itself from `CREDENTIALS_FOLDER` (443, with 80 redirecting); `TLS=proxy` serves plain HTTP on `PORT` behind Apache or nginx, with `TRUST_PROXY` (for example `loopback`) so the app sees the original scheme | `lib/server.js` |

`.env.example` lists every variable. Tests: [docs/testing.md](docs/testing.md).

## Easy Installation

On a fresh machine, this is the minimum to allow the MNP web site to run.

### Clone / Install dependencies / Setup minimal files and folders:

This assumes Node.js is installed - which is beyond the scope of these installation steps.

If no data folders exist, setupMNPFolders.sh will create them and populate with a minimal
sample 'season-0' with a single match.

```
git clone https://github.com/mondaynightpinball/main.git
source ./setupMNPFolders.sh
node http.js
```

To change the season, you can either edit the .env file (in the root project folder - created by
setupMNPFolders.sh.  Alternately, you can specify a different CURRENT_SEASON environment variable
on the command line.

```
CURRENT_SEASON=season-14
node http.js
```


## Manual Installation

### Clone and Install the dependencies:

```
git clone https://github.com/mondaynightpinball/main.git
npm i
```

### Setup necessary data paths (TODO: Make a setup script)
```
# Run from project home
mkdir data
mkdir data/ifpa
mkdir data/matches
mkdir data/players
mkdir data/sessions
mkdir data/stats

#starting with season 15 we are storing stats under the current season folder.

# As a backup and log of events, we save all non-auth posts to a directory.
mkdir data/posts

# All image data is currently just saved on the server.
# TODO: Save image data to a scalable storage service like AWS/S3
mkdir data/uploads

# You need season-# directories for any season you want to load.
# See model/seasons.js
mkdir data/season-8
```

## Config files

The code needs a few files setup to get things going.

### Data Archive

Many of the config files that were used for seasons 6, 7, and 8
are available, as well as all the match data, schedule, and rosters.

Visit the [data archive](https://github.com/mondaynightpinball/data-archive)

TODO: It would be awesome to have the code just point to a DATA_HOME .env var. Then people could clone the data archive and point the server code at it (until a better solution becomes available).

### Venues
The venues.json is not a per-season database.  It represents a realtime view of the venues.  New venues are added via the web interface by the superuser.

`data/venues.json` has the form:
```
{
  "ABC": {
    "name": "ABC Venue",
    "machines": [ array_of_machine_keys ],
    "key": "ABC",
    "address": "[Optional] 123 Fake St, Springfield, WA",
    "neighborhood", "[Optional] Neighborhood"
  },
  ...
}
```

### Machines

`data/machines.json` defines all the machines that are available to
be used in a match. People can still enter machines that are not on
this list (much to our dismay), but this is the source for machine keys and names.

```
{
  "MachineKey": {
    "key": "MachineKey",
    "name": "Machine Name"
  },
  ...
}
```

TODO: Probably don't need to include the key in the machine object, and we could probably also just store a map of key -> name.

### Ifpa

`data/ifpa_num.csv` is in the form of:

```
player_name,ifpa_num
...
```

Where the `ifpa_num` is the player's official IFPA number.
See [IFPA Player Search](https://www.ifpapinball.com/players/find.php)

### Season files

In each of the `data/season-{n}` directories, you need the following files:

`matches.csv` defines the schedule and should have the following columns:
```
week_num,date,away_key,home_key,venue_key
```

A special note that playoff weeks are denoted as `week_num = 90 + playoff_week`, so the first week of playoffs is week 91.

`teams.csv` defines teams and has columns:
```
team_key,venue_key,team_name
```

`playerdb.csv` is the master roster file and has columns:
```
player_lookup,player_name,team_key,role_on_team
```

`group.csv` contains a list of groups and the teams in each group
```
group_identifier, group_name, team_name, team_name, ...
```

`player_lookup` has most recently been `player_name.trim().toLowerCase()`.

TODO: It would be much better to have unique keys for every player.

### Gmail settings

Currently, there may be an issue that if you don't have a gmail OAuth token, you might run into issues when you start the server.

TODO: Add more details/resources on how to setup the gmail token.

### SSL settings

With `TLS=internal` (the default) the server reads `privkey.pem`, `cert.pem`
and `chain.pem` from `CREDENTIALS_FOLDER` (a Let's Encrypt live folder has
exactly these). With `TLS=proxy` it serves plain HTTP on `PORT` and the proxy
in front of it holds the certificate.

## League Operation

### Importing a season

Once you have all the season files above setup, you need to run the script that parses all the CSV files and generates a `season.json` (currently written to standard out, so I send that to a file on the command line).

```
node importers/import-season > data/season-{n}/season.json
```

### Generating a week of matches

The system doesn't filter which matches are visible, so it is usually advised to generate matches a few hours before they start.

This is one of the areas of the site that could be very much improved once we move to a proper database. That project exists and has a fair amount of test coverage. The goal is to integrate that backend code with this full stack project to replace the `model`s.

[Proposed New MNP Backend](https://github.com/mondaynightpinball/server)

### Generating stats

Eventually stats would likely be real time, but for now we run a script to generate player stats.

```
node run util/compute-stats
```

### Starting the server

To get things running, you can run one of the following commands:
```
# HTTPS on 443 with a redirect from 80 (TLS=internal, the default;
# needs the certificate files and root access).
node app.js

# Plain HTTP behind a reverse proxy that terminates TLS.
TLS=proxy PORT=6942 TRUST_PROXY=loopback node app.js

# The same two, as shortcuts.
node https.js
node http.js
```

If you are interested in how to wrap up the app to run as a service, we use `forever` and `forever-service`, both npm modules and not too hard to setup.
However, we don't feel like this is the best long term solution.
There are more solutions, and layers like `nginx` that can help clean up our solution.

## Contributing

We very much want developers to be able to help make the MNP site more reliable, secure, beautiful, and responsive. Feel free to submit PRs, and check out our [issues](https://github.com/mondaynightpinball/main/issues).
