/*
   The branding's content pages (home page, rules, and so on), read from
   BRANDING_FOLDER/pages at first use. When BRANDING_URL is set, each page is
   refreshed from <BRANDING_URL>/pages/<file> at most every REFRESH_INTERVAL_MS,
   in the background: the page served is always the last good copy, and a
   failed fetch is logged and retried after the interval.
*/
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const config = require('../config')
const brand = require('./branding')

const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 10 * 1000
const HTTP_OK = 200
const PAGES_PATH = 'pages'

const cache = {}

function missingPage(name) {
   return `<p>The "${name}" page has not been written for this league yet.</p>`
}

function load(name) {
   const file = brand.pageFile(name)
   let content = null
   if (file && fs.existsSync(file)) {
      content = fs.readFileSync(file).toString()
   } else {
      console.error(`content page "${name}": no file ${file || ''} in the branding folder`)
   }
   cache[name] = { content, fetchedAt: 0, pending: null }
   return cache[name]
}

function remoteUrl(name) {
   const file = brand.pageFiles[name]
   if (!config.BRANDING_URL || !file) return null
   return new URL(`${PAGES_PATH}/${file}`, config.BRANDING_URL.replace(/\/?$/, '/')).toString()
}

function fetchText(url) {
   return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http
      const req = client.get(url, { timeout: FETCH_TIMEOUT_MS }, res => {
         if (res.statusCode !== HTTP_OK) {
            res.resume()
            return reject(new Error(`HTTP ${res.statusCode}`))
         }
         const chunks = []
         res.on('data', chunk => chunks.push(chunk))
         res.on('end', () => resolve(Buffer.concat(chunks).toString()))
         res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new Error('timed out')))
      req.on('error', reject)
   })
}

// Refreshes one page from BRANDING_URL; resolves when done (used in the
// background by get(), and directly by tests).
function refresh(name) {
   const entry = cache[name] || load(name)
   const url = remoteUrl(name)
   if (!url) return Promise.resolve(entry.content)
   if (entry.pending) return entry.pending
   entry.pending = fetchText(url)
      .then(text => {
         entry.content = text
      })
      .catch(err => {
         console.error(`content page "${name}": keeping the current copy, could not fetch ${url}: ${err.message}`)
      })
      .then(() => {
         entry.fetchedAt = Date.now()
         entry.pending = null
         return entry.content
      })
   return entry.pending
}

// The page's HTML (a mustache partial rendered inside the base page).
function get(name) {
   const entry = cache[name] || load(name)
   if (config.BRANDING_URL && Date.now() - entry.fetchedAt >= REFRESH_INTERVAL_MS) {
      refresh(name)
   }
   return entry.content === null ? missingPage(name) : entry.content
}

module.exports = { get, refresh, REFRESH_INTERVAL_MS }
