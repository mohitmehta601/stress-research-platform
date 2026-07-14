import { connectDatabase, disconnectDatabase, ensureIndexes } from "./src/config/database.js";
import { models } from "./src/models/index.js";

await connectDatabase();
await ensureIndexes(models);
await disconnectDatabase();
console.log("MongoDB collections and indexes synchronized.");
