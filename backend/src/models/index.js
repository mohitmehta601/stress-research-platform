import mongoose from "mongoose";

const { Schema } = mongoose;

const loose = { strict: false, timestamps: false, minimize: false };

const participantSchema = new Schema(
  {
    email: { type: String, index: true, unique: true },
    participant_code: { type: String, index: true, unique: true },
    role: { type: String, default: "participant", index: true },
    is_active: { type: Boolean, default: true },
    approval_status: { type: String, default: "approved" },
    consent_completed: { type: Boolean, default: false },
    profile_completed: { type: Boolean, default: false },
    "consent.version": { type: String, index: true }
  },
  loose
);

const sessionSchema = new Schema(
  {
    participant_id: { type: Schema.Types.ObjectId, ref: "Participant", index: true },
    started_at: { type: Date, index: true },
    "physiological.recorded_at": { type: Date, index: true },
    "questionnaire.submitted_at": { type: Date, index: true },
    "doctor_assessment.created_at": { type: Date, index: true }
  },
  loose
);

sessionSchema.index({ participant_id: 1, started_at: -1 });

const tokenSchema = new Schema(
  {
    token_hash: { type: String, unique: true },
    expires_at: { type: Date, expires: 0 }
  },
  loose
);

const dashboardAccessRequestSchema = new Schema(
  {
    email: { type: String, index: true },
    status: { type: String, index: true },
    requested_at: { type: Date, index: true }
  },
  loose
);

const notificationSchema = new Schema(
  {
    created_at: { type: Date, index: true }
  },
  loose
);

const looseSchema = (collection) => new Schema({}, { ...loose, collection });

export const Participant = mongoose.model("Participant", participantSchema, "participants");
export const ResearchSession = mongoose.model("ResearchSession", sessionSchema, "sessions");
export const PasswordResetToken = mongoose.model("PasswordResetToken", tokenSchema, "password_reset_tokens");
export const DashboardAccessRequest = mongoose.model("DashboardAccessRequest", dashboardAccessRequestSchema, "dashboard_access_requests");
export const Notification = mongoose.model("Notification", notificationSchema, "notifications");
export const Physiological = mongoose.model("Physiological", looseSchema("physiological"));
export const QuestionnaireResponse = mongoose.model("QuestionnaireResponse", looseSchema("questionnaire_responses"));
export const DoctorAssessment = mongoose.model("DoctorAssessment", looseSchema("doctor_assessments"));

export const models = {
  Participant,
  ResearchSession,
  PasswordResetToken,
  DashboardAccessRequest,
  Notification
};
