/*
  Builds and starts the web server for the deployment described by the
  environment (see config.js):

    TLS=internal   serve HTTPS on PORT (443 by default) with privkey.pem,
                   cert.pem and chain.pem from CREDENTIALS_FOLDER, and
                   redirect plain HTTP on port 80 to HTTPS (MNP's setup)
    TLS=proxy      serve plain HTTP on PORT (80 by default) behind a reverse
                   proxy such as Apache that terminates TLS (NESLP's setup)
    TRUST_PROXY    Express's "trust proxy" setting for proxy deployments, so
                   req.protocol and req.ip reflect the original request:
                   "true", "loopback", a hop count, or an address list
*/
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const config = require('../config');

const TLS_INTERNAL = 'internal';
const TLS_PROXY = 'proxy';
const HTTPS_PORT = 443;
const HTTP_PORT = 80;
const CERT_FILES = { key: 'privkey.pem', cert: 'cert.pem', ca: 'chain.pem' };

function trustProxySetting(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

function createApp() {
  const app = express();
  const trust = trustProxySetting(config.TRUST_PROXY);

  if (trust !== false) app.set('trust proxy', trust);
  app.use('/', require('../route/main'));
  app.use(express.static(config.DATA_FOLDER + '/static'));
  return app;
}

function readCertificate() {
  const cert = {};

  Object.entries(CERT_FILES).forEach(([field, file]) => {
    cert[field] = fs.readFileSync(`${config.CREDENTIALS_FOLDER}/${file}`);
  });
  return cert;
}

function start() {
  const app = createApp();

  if (config.TLS === TLS_PROXY) {
    const port = Number(config.PORT) || HTTP_PORT;
    return http.createServer(app).listen(port, () => {
      console.log(`Listening for HTTP on port ${port} (behind a proxy)`);
    });
  }
  if (config.TLS !== TLS_INTERNAL) {
    throw new Error(`TLS must be "${TLS_INTERNAL}" or "${TLS_PROXY}", not "${config.TLS}"`);
  }
  const port = Number(config.PORT) || HTTPS_PORT;
  const server = https.createServer(readCertificate(), app).listen(port, () => {
    console.log(`Listening for HTTPS on port ${port}`);
  });
  const redirect = express();

  redirect.use((req, res) => {
    res.redirect('https://' + req.headers.host + req.url);
  });
  redirect.listen(HTTP_PORT);
  return server;
}

module.exports = { createApp, start, trustProxySetting };
