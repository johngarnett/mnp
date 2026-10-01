/*
   Starts the app on a temporary data folder seeded with the unknown-IPR scenario.
   Launched by playwright.config.js; the data folder is removed on shutdown.
*/
const fixture = require('../helpers/fixture')
const scenario = require('../helpers/ipr-scenario')

const DEFAULT_PORT = 6943
const port = Number(process.env.E2E_PORT) || DEFAULT_PORT

scenario.setup()
scenario.createPregameMatch()

const server = fixture.createApp().listen(port)

function shutdown() {
   server.close()
   fixture.cleanup()
   process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
