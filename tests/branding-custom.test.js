/*
  A league's own branding folder: no PLAYER menu, a LOGIN entry that carries
  the page's redirect_url, a page the branding leaves out, content pages
  refreshed from BRANDING_URL (a failed fetch keeps the current copy), and
  PUBLIC_URL for the links in emails.
*/
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const REMOTE_PORT = 6951;
const PUBLIC_URL = 'https://league.example.com';
const EXAMPLE_FOLDER = path.join(__dirname, '..', 'branding', 'example');
const LOCAL_HOME = '<p>LOCAL HOME</p>';
const REMOTE_HOME = '<p>REMOTE HOME</p>';
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const HTTP_NOT_FOUND = 404;

// Build the branding folder before the app reads BRANDING_FOLDER.
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'branding-custom-'));
fs.cpSync(EXAMPLE_FOLDER, folder, { recursive: true });
const league = JSON.parse(fs.readFileSync(path.join(EXAMPLE_FOLDER, 'league.json')));
league.name = 'Custom League';
league.playerMenu = null;
league.mainMenu = [
  { label: 'HOME', href: '/' },
  { label: 'LOGIN', href: '/login', redirect: true }
];
league.pages = { newplayers: 'not-written.html' };
fs.writeFileSync(path.join(folder, 'league.json'), JSON.stringify(league));
fs.writeFileSync(path.join(folder, 'pages', 'index.html'), LOCAL_HOME);

process.env.BRANDING_FOLDER = folder;
process.env.BRANDING_URL = `http://127.0.0.1:${REMOTE_PORT}/raw/`;
process.env.PUBLIC_URL = PUBLIC_URL;

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fixture = require('./helpers/fixture');

const SIGNUP_EMAIL = 'custom.person@example.com';

fixture.setup();

const brand = require('../lib/branding');
const pages = require('../lib/content-pages');
const app = fixture.createApp();

function todaysPin() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return String(now.getFullYear() % 100) + pad(now.getMonth() + 1) + pad(now.getDate());
}

// The branding repo's raw files: a newer home page, a broken rules page.
const remote = http.createServer((req, res) => {
  if (req.url === '/raw/pages/index.html') return res.writeHead(HTTP_OK).end(REMOTE_HOME);
  if (req.url === '/raw/pages/leaguerules.html')
    return res.writeHead(HTTP_SERVER_ERROR).end('broken');
  res.writeHead(HTTP_NOT_FOUND).end();
});

describe('a custom branding folder', () => {
  before(() => new Promise(resolve => remote.listen(REMOTE_PORT, resolve)));
  after(() => {
    remote.close();
    fixture.cleanup();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('loads from BRANDING_FOLDER', () => {
    assert.equal(brand.name, 'Custom League');
    assert.equal(brand.hasPlayerMenu, false);
  });

  it('shows one menu, with the login link carrying the redirect', async () => {
    const home = await request(app).get('/');
    const login = await request(app).get('/login?redirect_url=/matches');

    assert.equal((home.text.match(/dropdown-toggle/g) || []).length, 1);
    assert.ok(!home.text.includes('MY MATCH'));
    assert.ok(home.text.includes('href="/login">LOGIN</a>'));
    // The redirect value is user input, so it stays HTML-escaped.
    assert.ok(login.text.includes('href="/login?redirect_url=&#x2F;matches">LOGIN</a>'));
  });

  it('serves the local copy of a page the remote does not have', async () => {
    const local = fs.readFileSync(path.join(folder, 'pages', 'matchrules.html')).toString();

    await pages.refresh('matchrules');
    const res = await request(app).get('/matchrules');

    assert.ok(res.text.includes(local));
  });

  it('serves the remote copy of a page once a refresh succeeds', async () => {
    assert.equal(fs.readFileSync(path.join(folder, 'pages', 'index.html')).toString(), LOCAL_HOME);
    await pages.refresh('index');
    const res = await request(app).get('/');

    assert.ok(res.text.includes(REMOTE_HOME));
  });

  it('keeps the current copy when the refresh fails', async () => {
    const original = fs.readFileSync(path.join(folder, 'pages', 'leaguerules.html')).toString();

    await pages.refresh('leaguerules');
    const res = await request(app).get('/leaguerules');

    assert.ok(res.text.includes(original));
  });

  it('says so for a page the branding has not written', async () => {
    const res = await request(app).get('/newplayers');

    assert.equal(res.status, HTTP_OK);
    assert.ok(res.text.includes('has not been written'));
  });

  it('uses PUBLIC_URL for the links in emails', async () => {
    await request(app).post('/signup').type('form').send({
      name: 'Custom Person',
      email: SIGNUP_EMAIL,
      answerX: todaysPin(),
      questionX: 'pin'
    });
    const sent = fixture.sentEmails.find(e => e.to === SIGNUP_EMAIL);

    assert.ok(sent, 'a verification email was sent');
    assert.ok(sent.message.includes(`${PUBLIC_URL}/verify/`));
  });
});
