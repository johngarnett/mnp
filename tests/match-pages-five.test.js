// Runs tests/match-pages.test.js under the five-player format.
process.env.FIVE_PLAYER_PAGES = '1';
require('./match-pages.test.js');
