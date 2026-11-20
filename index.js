const { onRequest } = require('firebase-functions/v2/https');
const app = require('./src/server');

// Export the Express app as a Cloud Function (2nd gen)
exports.enteArazhyBackend = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10, // cost and database-connection safety cap
    // minInstances: 1, // optional: removes cold starts, but costs money even when idle
  },
  app
);