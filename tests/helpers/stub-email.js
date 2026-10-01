/*
   Replaces lib/email in the require cache so no SMTP connection is made. Loaded by
   fixture.setup() in test processes, and with `node --require` for app scripts that
   tests run as child processes. Messages are collected in sentEmails.
*/
const path = require('path')

const emailPath = require.resolve(path.join(__dirname, '..', '..', 'lib', 'email'))
const sentEmails = []

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

module.exports = { sentEmails }
