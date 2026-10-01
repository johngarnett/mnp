/*
   Starts the app for browser tests on a temporary data folder seeded with every
   scenario in SCENARIOS. Launched by playwright.config.js; the data folder is
   removed on shutdown.
*/
const fixture = require('../helpers/fixture')

const SCENARIOS = [
   require('../helpers/ipr-scenario'),
   require('../helpers/pick-lists-scenario'),
   require('../helpers/sub-names-scenario'),
   require('../helpers/machines-scenario')
]
const DEFAULT_PORT = 6943
const port = Number(process.env.E2E_PORT) || DEFAULT_PORT

// Combines each scenario's fixture.setup() options into one.
function mergeOptions(scenarios) {
   return scenarios.reduce((merged, { options }) => ({
      ratings: [...merged.ratings, ...(options.ratings || [])],
      season: {
         teams: { ...merged.season.teams, ...options.season?.teams },
         groups: { ...merged.season.groups, ...options.season?.groups },
         weeks: [...merged.season.weeks, ...(options.season?.weeks || [])]
      }
   }), { ratings: [], season: { teams: {}, groups: {}, weeks: [] } })
}

fixture.setup(mergeOptions(SCENARIOS))
SCENARIOS.forEach(scenario => scenario.seed())

const server = fixture.createApp().listen(port)

function shutdown() {
   server.close()
   fixture.cleanup()
   process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
