import { connectDatabase, disconnectDatabase, ensureIndexes } from "./src/config/database.js";
import { models } from "./src/models/index.js";

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
await dropLegacyIndexes();
await ensureIndexes(models);
await disconnectDatabase();
console.log("MongoDB collections and indexes synchronized.");
