/*
   Shared data for the machines page tests: the admin has a known session ID so
   browser tests can log in. Uses the fixture's machines.
*/
const fixture = require('./fixture')

const SESSION_ID = 'machines-admin'

const options = {}

function seed() {
   fixture.login(fixture.ADMIN_KEY, SESSION_ID)
}

module.exports = {
   SESSION_ID,
   options,
   seed
}
