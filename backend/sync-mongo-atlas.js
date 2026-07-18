import { connectDatabase, disconnectDatabase, ensureIndexes } from "./src/config/database.js";
import { models } from "./src/models/index.js";

async function ensureCollections() {
  for (const model of Object.values(models)) {
    await model.createCollection();
    console.log(`Ensured collection: ${model.collection.name}`);
  }
}

async function dropLegacyIndexes() {
  const sessionIndexes = await models.ResearchSession.collection.indexes().catch(() => []);
  const legacySessionCode = sessionIndexes.find((index) => (
    index.name === "session_code_1"
    || JSON.stringify(index.key) === JSON.stringify({ session_code: 1 })
  ));
  if (legacySessionCode) {
    await models.ResearchSession.collection.dropIndex(legacySessionCode.name);
    console.log(`Dropped legacy global sessions index: ${legacySessionCode.name}`);
  }
}

await connectDatabase();
await ensureCollections();
await dropLegacyIndexes();
await ensureIndexes(models);
for (const model of Object.values(models)) {
  const indexes = await model.collection.indexes().catch(() => []);
  console.log(`${model.collection.name}: ${indexes.length} indexes`);
}
await disconnectDatabase();
console.log("MongoDB collections and indexes synchronized.");
