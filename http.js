// Plain HTTP behind a reverse proxy (the same as TLS=proxy with app.js).
process.env.TLS = 'proxy';
require('./lib/server').start();
