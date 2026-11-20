// scripts/create-indexes.js  (run once with: node scripts/create-indexes.js)
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { connectToDatabase, disconnectFromDatabase } = require('../src/lib/mongoose');

require('../src/models/church.model');
require('../src/models/division.model');
require('../src/models/event.model');
require('../src/models/family.model');
require('../src/models/member.model');
require('../src/models/token.model');
require('../src/models/bibleVerse.model');
require('../src/models/churchInfo.model');

(async () => {
  await connectToDatabase();
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).createIndexes(); // creates missing indexes only
    console.log('Indexes ready:', name);
  }
  await disconnectFromDatabase();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});