import { connectDatabase, disconnectDatabase } from "./src/config/database.js";
import { bootstrapResearcher } from "./src/services/auth.js";

await connectDatabase();
await bootstrapResearcher();
await disconnectDatabase();
console.log("Super-admin synchronization complete.");
