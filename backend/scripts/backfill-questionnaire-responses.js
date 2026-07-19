import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  Participant,
  QuestionnaireResponse,
  ResearchSession,
} from "../src/models/index.js";

async function main() {
  await connectDatabase();

  const existingResponses = await QuestionnaireResponse.find({}).lean();
  let removed = 0;
  for (const response of existingResponses) {
    if (!response.answers || Object.keys(response.answers).length === 0) {
      await QuestionnaireResponse.deleteOne({ _id: response._id });
      removed += 1;
    }
  }

  const sessions = await ResearchSession.find({
    questionnaire: { $exists: true },
  }).lean();

  const participantIds = sessions
    .map((session) => session.participant_id)
    .filter(Boolean);

  const participants = await Participant.find({
    _id: { $in: participantIds },
  }).lean();

  const participantById = new Map(
    participants.map((participant) => [
      String(participant._id),
      participant,
    ]),
  );

  let upserted = 0;

  for (const session of sessions) {
    const questionnaire = session.questionnaire || {};
    if (!questionnaire.answers || Object.keys(questionnaire.answers).length === 0) {
      await QuestionnaireResponse.deleteOne({ session_id: session._id });
      removed += 1;
      continue;
    }

    const participant = participantById.get(String(session.participant_id));
    const submittedAt = questionnaire.submitted_at || new Date();

    await QuestionnaireResponse.updateOne(
      { session_id: session._id },
      {
        $set: {
          participant_id: session.participant_id,
          participant_code: participant?.participant_code,
          session_id: session._id,
          session_code: session.session_code,
          condition: questionnaire.condition || session.condition,
          questionnaire_key: questionnaire.questionnaire_key || "post-session-v1",
          answers: questionnaire.answers || {},
          score: questionnaire.score ?? null,
          submitted_at: submittedAt,
          updated_at: questionnaire.updated_at || submittedAt,
        },
        $setOnInsert: {
          created_at: submittedAt,
        },
      },
      { upsert: true },
    );

    upserted += 1;
  }

  console.log(`Backfilled ${upserted} filled questionnaire response(s). Removed ${removed} empty placeholder response(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
