const functions = require('firebase-functions/v1');
const app = require('./src/server');

exports.enteArazhyBackend = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 60,
    // minInstances: 1, // optional: removes cold starts, but costs money even when idle
  })
  .https.onRequest(app);