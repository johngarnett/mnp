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

- `fixture.createApp()` returns an Express app using `route/main`.
- `fixture.login(playerKey)` writes a session and returns a `Cookie` header.
- `fixture.createPlayer({ key, name })` adds a player file.
- `fixture.ADMIN_KEY` is a player who is a league admin (can act as captain).
- `fixture.sentEmails` collects messages; `lib/email` is stubbed so no mail is
  sent.

## Ported changes

Every change ported from mnp (see `docs/backlog.md`) gets a test in `tests/`
named after the change. Confirm the test fails on the code before the port and
passes after it.
