require('dotenv').load();

const config = {
  CREDENTIALS_FOLDER: process.env.CREDENTIALS_FOLDER ||  __dirname + '/credentials',
  DATA_FOLDER: process.env.DATA_FOLDER || __dirname + '/data',
  UPLOADS_FOLDER: process.env.UPLOADS_FOLDER || __dirname + '/data/uploads',
  CURRENT_SEASON: process.env.CURRENT_SEASON || 'season-23',
  NUM_WEEKS: process.env.NUM_WEEKS || 10,
  //The league's branding: a checkout of its branding repo (see docs/branding.md).
  //BRANDING_URL, when set, is the raw base URL of that repo, from which the
  //content pages are refreshed while the server runs.
  BRANDING_FOLDER: process.env.BRANDING_FOLDER || __dirname + '/branding/example',
  BRANDING_URL: process.env.BRANDING_URL,
  //Deployment: TLS=internal serves HTTPS itself (443, with 80 redirecting);
  //TLS=proxy serves plain HTTP on PORT behind a reverse proxy such as Apache.
  TLS: process.env.TLS || 'internal',
  PORT: process.env.PORT,
  TRUST_PROXY: process.env.TRUST_PROXY,
  //The site's public address for links in emails (default: the request's host).
  PUBLIC_URL: process.env.PUBLIC_URL,
  CREDENTIALS_FOLDER: process.env.CREDENTIALS_FOLDER || './credentials',
  IFPA_API_KEY: process.env.IFPA_API_KEY,
  SCORE_SERVICE_URL: process.env.SCORE_SERVICE_URL || 'https://api.scores.pinball.group',
  SCORE_SERVICE_API_KEY: process.env.SCORE_SERVICE_API_KEY,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_NAME: process.env.EMAIL_NAME,
  EMAIL_ADDRESS: process.env.EMAIL_ADDRESS,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  LEAGUE_ADMINS: (process.env.LEAGUE_ADMINS || "admin").split(',')
};

module.exports = config;
