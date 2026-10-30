// HTTPS served by this process (the same as TLS=internal with app.js). The
// certificate files are privkey.pem, cert.pem and chain.pem in CREDENTIALS_FOLDER.
process.env.TLS = 'internal';
require('./lib/server').start();
