const functions = require('firebase-functions');
const app = require('./src/server');

// Export the Express app as a Cloud Function
exports.enteArazhyBackend = functions.https.onRequest(app);
