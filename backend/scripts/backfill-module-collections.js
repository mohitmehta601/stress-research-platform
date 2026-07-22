import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  DoctorAssessment,
  Participant,
  Physiological,
  QuestionnaireResponse,
  ResearchSession,
} from "../src/models/index.js";
import { THINGSPEAK_FIELD_DEFS, normalizePhysiologicalPayload } from "../src/services/thingspeak.js";

function hasPhysiologicalValues(physiological) {
  return Boolean(
    physiological
    && THINGSPEAK_FIELD_DEFS.some((def) => typeof physiological[def.key] === "number")
  );
}

function hasFilledQuestionnaireAnswers(questionnaire) {
  return Boolean(
    questionnaire
    && questionnaire.answers
    && typeof questionnaire.answers === "object"
    && Object.keys(questionnaire.answers).length > 0
  );
}

async function main() {
  await connectDatabase();

  const sessions = await ResearchSession.find({}).lean();
  const participants = await Participant.find({
    _id: { $in: sessions.map((session) => session.participant_id).filter(Boolean) },
  }).lean();
  const participantById = new Map(
    participants.map((participant) => [String(participant._id), participant]),
  );

  let physiologicalCount = 0;
  let questionnaireCount = 0;
  let doctorCount = 0;
  let removedEmptyQuestionnaires = 0;

  for (const session of sessions) {
    const participant = participantById.get(String(session.participant_id));

    if (session.physiological) {
      const physiological = normalizePhysiologicalPayload({
        ...session.physiological,
        condition: session.physiological.condition || session.condition,
      });

      if (hasPhysiologicalValues(physiological)) {
        const recordedAt = physiological.recorded_at ? new Date(physiological.recorded_at) : new Date();
        await Physiological.updateOne(
          { session_id: session._id },
          {
            $set: {
              ...physiological,
              participant_id: session.participant_id,
              participant_code: participant?.participant_code || "",
              session_id: session._id,
              session_code: session.session_code,
              condition: physiological.condition || session.condition,
              thingspeak_entry_id: physiological.thingspeak?.entry_id ?? physiological.thingspeak_entry_id ?? null,
              recorded_at: recordedAt,
              updated_at: physiological.updated_at || new Date(),
            },
            $setOnInsert: {
              created_at: recordedAt,
            },
          },
          { upsert: true },
        );
        physiologicalCount += 1;
      }
    }

    if (hasFilledQuestionnaireAnswers(session.questionnaire)) {
      const questionnaire = session.questionnaire;
      const submittedAt = questionnaire.submitted_at || new Date();
      await QuestionnaireResponse.updateOne(
        { session_id: session._id },
        {
          $set: {
            participant_id: session.participant_id,
            participant_code: participant?.participant_code || "",
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
      questionnaireCount += 1;
    } else {
      const result = await QuestionnaireResponse.deleteOne({ session_id: session._id });
      if (result.deletedCount) removedEmptyQuestionnaires += result.deletedCount;
    }

    if (session.doctor_assessment?.clinical_stress || session.doctor_assessment?.clinical_stress_label) {
      const assessment = session.doctor_assessment;
      const createdAt = assessment.created_at ? new Date(assessment.created_at) : new Date();
      const clinicalStress = String(assessment.clinical_stress || assessment.clinical_stress_label || "").toLowerCase();
      await DoctorAssessment.updateOne(
        { session_id: session._id },
        {
          $set: {
            participant_id: session.participant_id,
            participant_code: participant?.participant_code || "",
            session_id: session._id,
            session_code: session.session_code,
            condition: session.condition,
            clinical_stress: clinicalStress,
            clinical_stress_label: clinicalStress,
            comments: assessment.comments ?? null,
            recommendation: assessment.recommendation ?? null,
            status: "completed",
            created_at: createdAt,
            updated_at: assessment.updated_at || new Date(),
          },
          $setOnInsert: {
            inserted_at: createdAt,
          },
        },
        { upsert: true },
      );
      doctorCount += 1;
    }
  }

  console.log(
    `Backfilled collections: physiological=${physiologicalCount}, questionnaire_responses=${questionnaireCount}, doctor_assessments=${doctorCount}, removed_empty_questionnaires=${removedEmptyQuestionnaires}.`,
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
