// Runs tests/compute-stats.test.js under the five-player format.
process.env.FIVE_PLAYER_STATS = '1';
require('./compute-stats.test.js');
