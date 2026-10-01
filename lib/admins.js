/*
   League admins are the ROOT key and the player keys in LEAGUE_ADMINS.
*/
const CONST = require('../constants')
const config = require('../config')

function isAdmin(ukey) {
   return !!ukey && (ukey === CONST.ROOT || config.LEAGUE_ADMINS.includes(ukey))
}

module.exports = { isAdmin }
