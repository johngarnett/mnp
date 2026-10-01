# Testing

Tests live in `tests/` and use Node's built-in test runner (`node:test`) with
[supertest](https://github.com/forwardemail/supertest) for HTTP requests against
the real Express router. The old scripts in `test/` are not part of the suite.

```sh
npm test                              # run everything
node --test tests/picks-resubmit.test.js   # run one file
TEST_VERBOSE=1 npm test               # keep the app's console.log output
```

Run tests from the project root; templates are read with relative paths.

## Fixture

`tests/helpers/fixture.js` builds a throwaway data folder (the layout from
`setupMNPFolders.sh`) in the OS temp directory and points the app at it through
`DATA_FOLDER`, `CURRENT_SEASON`, and `LEAGUE_ADMINS`. App modules read those
values when they are first required, so every test file must call
`fixture.setup()` **before** requiring anything from the app:

```js
const fixture = require('./helpers/fixture')

fixture.setup()

const matches = require('../model/matches')   // safe: uses the temp folder
```

`setup()` refuses to run if `config.DATA_FOLDER` is not the temp folder, so a
test can never write to the real `data/` folder. Each test file runs in its own
process and gets its own fixture; call `fixture.cleanup()` in an `after` hook.

Helpers:

- `fixture.setup({ ratings, season })` optionally adds `{ name, ipr }` rows to
  `IPR.csv` and merges fields (`teams`, `groups`, `weeks`) into `season.json`.
- `fixture.createApp()` returns an Express app using `route/main`.
- `fixture.login(playerKey, sessionId?)` writes a session and returns a `Cookie`
  header. Pass `sessionId` when the value must be known in advance.
- `fixture.createPlayer({ key, name })` adds a player file.
- `fixture.VENUE_MACHINES` / `fixture.MACHINE_NAMES`: the test venue's machines,
  whose venue, key, and name orders all differ.
- `fixture.ADMIN_KEY` is a player who is a league admin (can act as captain).
- `fixture.sentEmails` collects messages; `lib/email` is stubbed so no mail is
  sent.
- `fixture.STUB_EMAIL_PRELOAD` is the stub's path, for running app scripts as
  child processes without email: `node --require <path> util/compute-stats.js`
  with `env: process.env` (see `tests/player-stats.test.js`).

## Ported changes

Every change ported from mnp (see `docs/backlog.md`) gets a test in `tests/`
named after the change. Confirm the test fails on the code before the port and
passes after it.

## Browser tests (Playwright)

Page-level changes also get a Playwright test in `tests/e2e/*.spec.js`, run at
phone (Pixel 7), tablet (Galaxy Tab S4), and desktop (Desktop Chrome) sizes.

```sh
npx playwright install chromium   # once, to download the browser
npm run test:e2e                  # run all browser tests
npx playwright test --project=phone   # one screen size
npx playwright show-report        # view results and screenshots
```

`playwright.config.js` starts `tests/e2e/server.js`, which seeds one temporary
data folder with every scenario in its `SCENARIOS` list and serves the app on
port 6943. It refuses to reuse a server that is already running, so browser
tests never touch real league data, and it stops the server with SIGTERM so the
temporary folder is deleted.

Scenario data shared between unit and browser tests lives in
`tests/helpers/*-scenario.js`. A scenario exports `options` (passed to
`fixture.setup()`; the e2e server merges them) and `seed()` (creates matches and
sessions after setup). Scenarios must use distinct match keys. To add a browser
test, write a scenario, add it to `SCENARIOS`, and write a spec. For pages that
need a logged-in captain, the scenario calls `fixture.login(ADMIN_KEY, SESSION_ID)`
with a fixed ID, and the spec adds a `fixture.COOKIE_NAME` cookie with that
value (see `tests/e2e/pick-lists.spec.js`).
