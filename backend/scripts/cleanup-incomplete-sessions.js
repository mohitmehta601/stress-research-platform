import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  QuestionnaireResponse,
  ResearchSession,
} from "../src/models/index.js";

async function main() {
  await connectDatabase();

  const incompleteSessions = await ResearchSession.find({
    status: { $ne: "completed" },
  }).select("_id session_code status").lean();

  const sessionIds = incompleteSessions.map((session) => session._id);

  const [sessionResult, questionnaireResult] = await Promise.all([
    ResearchSession.deleteMany({ _id: { $in: sessionIds } }),
    QuestionnaireResponse.deleteMany({ session_id: { $in: sessionIds } }),
  ]);

  console.log(
    `Removed ${sessionResult.deletedCount || 0} incomplete session(s) and ${questionnaireResult.deletedCount || 0} related questionnaire response(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
