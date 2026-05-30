const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/enteArazhyDB'); // Change DB name if needed

  const collection = mongoose.connection.collection('members');
  const indexes = await collection.indexes();

  // Drop all text indexes
  for (const idx of indexes) {
    if (idx.key && Object.values(idx.key).includes('text')) {
      console.log('Dropping index:', idx.name);
      await collection.dropIndex(idx.name);
    }
  }

  // Create the correct text index
  await collection.createIndex(
    { fullName: 'text', firstName: 'text', lastName: 'text' }
  );
  console.log('Created new text index on fullName, firstName, lastName');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});