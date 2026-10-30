# Branding

Everything that names a league lives outside this repository, in a branding
folder that is a checkout of the league's own branding repository:

```
league.json       names, menus, addresses (below)
pages/            content pages: index.html (the home page), leaguerules.html,
                  matchrules.html, newplayers.html, ratings.html,
                  handicapping.html, new-teams.html, thanks.html
email/            verify.html, forgotpass.html
static/           icon_128.png, favicon.ico, brand.css, scoresheet.pdf and any
                  other files, served at the site root ahead of the app's own
```

`branding/example` in this repository is a generic league with that layout. It
is the default, so a fresh clone and the tests run without any setting.

## Settings

| Variable | Meaning |
|---|---|
| `BRANDING_FOLDER` | Path to the branding checkout. Default: `branding/example`. |
| `BRANDING_URL` | Optional. The raw base URL of the branding repository (for GitHub, `https://raw.githubusercontent.com/<org>/<repo>/main`). The pages in `pages/` are refreshed from `<BRANDING_URL>/pages/<file>` in the background, at most every five minutes, so the league edits its home page in the repository without a deploy. A failed fetch is logged and the last good copy stays up. |
| `PUBLIC_URL` | Optional. The site's address for the links in emails, e.g. `https://league.example.com`. Default: `publicUrl` from `league.json`, else the address the request came to. |

The server, match format and deployment are separate settings; see the README.

## league.json

```json
{
  "name": "Example Pinball League",
  "shortName": "EPL",
  "titlePrefix": "Example Pinball League",
  "copyright": "Example Pinball League",
  "timeZone": "America/Los_Angeles",
  "matchKeyPrefix": "epl",
  "publicUrl": "https://league.example.com",
  "contactEmail": "league@example.com",
  "conductEmail": "league@example.com",
  "emailName": "Example Pinball League",
  "emailSubjects": { "verify": "EPL - Confirm Email", "forgotPassword": "EPL - Reset Password" },
  "mainMenu": [ { "label": "HOME", "href": "/" }, { "label": "LOGIN", "href": "/login", "redirect": true } ],
  "playerMenu": [ { "label": "MY MATCH", "href": "/mymatch" } ],
  "pages": { "newplayers": "joining.html" }
}
```

| Field | Use |
|---|---|
| `name`, `shortName` | The league's names, in page text and emails. |
| `titlePrefix` | Heads every browser title: `<titlePrefix>: <page>`. |
| `copyright` | Footer text after the copyright sign. Leave out for no footer. |
| `timeZone` | IANA time zone for the clock times on the match pages. |
| `matchKeyPrefix` | First part of league match keys, as `importers/import-season.js` writes them: `<prefix>-<season>-<week>-...`. Matches with other keys (scrimmages) don't mark substitutes or count in stats. |
| `publicUrl` | See `PUBLIC_URL`. |
| `contactEmail` | Shown where pages tell players how to reach the league (`{{brand.contactEmail}}` in templates). |
| `conductEmail` | Where the Report Player Conduct form is sent. Without it, reports are logged and dropped. |
| `emailName` | Not read by the server yet; `EMAIL_NAME` in the environment names the sender. |
| `emailSubjects` | Subjects of the verification and password-reset emails. Default: `<shortName> - Confirm Email` and `<shortName> - Reset Password`. |
| `mainMenu` | The upper-left menu: `label` and `href` per entry. `"redirect": true` appends the page's `redirect_url` to the link (for a login entry). |
| `playerMenu` | The upper-right PLAYER menu, shown with the player's first name when logged in, or `null` for a single menu. |
| `pages` | Overrides the file name of a content page. |

Required: `name`, `shortName`, `titlePrefix`, `timeZone`, `matchKeyPrefix`,
`mainMenu`. The server refuses to start on a missing or invalid file and says
why.

## Pages and emails

The files in `pages/` are HTML fragments rendered inside the site's page frame
as mustache partials, so they can use `{{brand.name}}`, `{{brand.contactEmail}}`
and the other `league.json` fields. A page the folder doesn't have renders a
short "not written yet" notice. The routes are `/`, `/leaguerules`,
`/matchrules`, `/newplayers`, `/ratings`, `/handicapping`, `/new-teams`, and
`thanks.html` is shown after a sign-up.

`email/verify.html` and `email/forgotpass.html` are the verification and
password-reset emails; they get `{{name}}`, `{{&link}}` and `{{brand}}`.

`static/brand.css` is loaded after the app's `base.css`, for a background image
or other styling. `/scoresheet` serves `static/scoresheet.pdf` when present.

## Setting up a league

1. Create a repository with the layout above (start from `branding/example`).
2. On the server, clone it next to the data folder and set `BRANDING_FOLDER`
   to the clone; set `BRANDING_URL` if the league edits pages in the
   repository and wants them live without a deploy.
3. Choose `MATCH_FORMAT` (see `docs/formats.md`) and the deployment settings
   (README).
