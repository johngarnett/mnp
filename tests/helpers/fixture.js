/*
   Test fixture: builds a throwaway DATA_FOLDER that mirrors the layout created by
   setupMNPFolders.sh, points the app at it, and provides helpers for logging in
   and building an Express app around the real router.

   App modules read DATA_FOLDER and CURRENT_SEASON when they are first required,
   so setup() must run before anything from the app is required. node --test runs
   each test file in its own process, so each file gets a fresh fixture.
*/
const fs = require('fs')
const os = require('os')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const TEMP_PREFIX = 'neslp-test-'
const TEST_SEASON = 'season-test'
const ADMIN_KEY = 'test-admin'
const ADMIN_NAME = 'Test Admin'
const ADMIN_IPR = 3
const COOKIE_NAME = 'mnp_sess'
const VENUE_KEY = 'TESTV'
const VENUE_MACHINES = ['TAF', 'MM', 'AFM']
const VERBOSE_ENV = 'TEST_VERBOSE'

const DATA_DIRS = ['ifpa', 'matches', 'players', 'posts', 'sessions', 'stats', 'uploads', 'signups']
const EMPTY_FILES = ['.shadows', '.tokens']

let dataFolder = null
let sessionCount = 0
const sentEmails = []

function writeJson(file, value) {
   fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

// options.ratings: [{ name, ipr }] added to IPR.csv
// options.season: fields merged over the default season.json (teams, groups, weeks)
function setup(options = {}) {
   if (dataFolder) return dataFolder
   if (process.cwd() !== PROJECT_ROOT) {
      throw new Error(`Tests must run from ${PROJECT_ROOT} because templates are read with relative paths`)
   }

   dataFolder = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX))
   DATA_DIRS.forEach(dir => fs.mkdirSync(path.join(dataFolder, dir)))
   EMPTY_FILES.forEach(file => fs.writeFileSync(path.join(dataFolder, file), ''))
   fs.mkdirSync(path.join(dataFolder, TEST_SEASON, 'matches'), { recursive: true })

   const ratings = [{ name: ADMIN_NAME, ipr: ADMIN_IPR }, ...(options.ratings || [])]
   fs.writeFileSync(path.join(dataFolder, 'IPR.csv'), ratings.map(r => `${r.ipr},${r.name}\n`).join(''))
   writeJson(path.join(dataFolder, 'machines.json'), Object.fromEntries(
      VENUE_MACHINES.map(key => [key, { key, name: key }])
   ))
   writeJson(path.join(dataFolder, 'venues.json'), {
      [VENUE_KEY]: { key: VENUE_KEY, name: 'Test Venue', machines: VENUE_MACHINES }
   })
   writeJson(path.join(dataFolder, TEST_SEASON, 'season.json'), {
      key: TEST_SEASON,
      teams: {},
      groups: {},
      weeks: [],
      ...options.season
   })

   // dotenv does not override variables that are already set, so these win over .env.
   process.env.DATA_FOLDER = dataFolder
   process.env.CURRENT_SEASON = TEST_SEASON
   process.env.LEAGUE_ADMINS = ADMIN_KEY

   createPlayer({ key: ADMIN_KEY, name: ADMIN_NAME })
   stubEmail()

   if (!process.env[VERBOSE_ENV]) {
      console.log = () => {}
   }

   const config = require('../../config')
   if (config.DATA_FOLDER !== dataFolder) {
      throw new Error(`Refusing to run: DATA_FOLDER is ${config.DATA_FOLDER}, expected ${dataFolder}`)
   }
   return dataFolder
}

// Replaces lib/email in the require cache so no SMTP connection is made and
// tests can inspect outgoing messages through sentEmails.
function stubEmail() {
   const emailPath = require.resolve('../../lib/email')

   require.cache[emailPath] = {
      id: emailPath,
      filename: emailPath,
      loaded: true,
      exports: {
         send: (to, subject, message, htmlMessage) => {
            sentEmails.push({ to, subject, message, htmlMessage })
         }
      }
   }
}

function createPlayer({ key, name, email = `${key}@example.com` }) {
   writeJson(path.join(dataFolder, 'players', key), {
      key,
      name,
      email,
      created_at: Date.now(),
      verified: true
   })
}

// Writes a session file for the player and returns the Cookie header value.
function login(playerKey) {
   sessionCount++
   const sessionId = `test-session-${sessionCount}`
   writeJson(path.join(dataFolder, 'sessions', sessionId), {
      key: playerKey,
      created_at: Date.now()
   })
   return `${COOKIE_NAME}=${sessionId}`
}

function createApp() {
   const express = require('express')
   const app = express()

   app.use('/', require('../../route/main'))
   return app
}

function cleanup() {
   if (dataFolder) {
      fs.rmSync(dataFolder, { recursive: true, force: true })
      dataFolder = null
   }
}

module.exports = {
   ADMIN_KEY,
   TEST_SEASON,
   VENUE_KEY,
   VENUE_MACHINES,
   sentEmails,
   setup,
   createPlayer,
   login,
   createApp,
   cleanup
}
