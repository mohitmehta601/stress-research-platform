import mongoose from "mongoose";

const { Schema } = mongoose;

const loose = { strict: false, timestamps: false, minimize: false };

const participantSchema = new Schema(
  {
    email: { type: String, index: true, unique: true },
    participant_code: { type: String, index: true, unique: true },
    name: { type: String },
    password_hash: { type: String },
    role: { type: String, default: "participant", index: true },
    is_active: { type: Boolean, default: true },
    approval_status: { type: String, default: "approved" },
    email_verified: { type: Boolean, default: false, index: true },
    consent_completed: { type: Boolean, default: false },
    profile_completed: { type: Boolean, default: false },
    "consent.version": { type: String, index: true },
    created_at: { type: Date, index: true },
    updated_at: { type: Date }
  },
  loose
);

participantSchema.index({ role: 1, created_at: -1 });
participantSchema.index({ approval_status: 1, role: 1 });

const sessionSchema = new Schema(
  {
    participant_id: { type: Schema.Types.ObjectId, ref: "Participant", index: true },
    session_code: { type: String },
    condition: { type: String, index: true },
    status: { type: String, index: true },
    signal_quality: { type: String, index: true },
    started_at: { type: Date, index: true },
    completed_at: { type: Date },
    "physiological.recorded_at": { type: Date, index: true },
    "physiological.signal_quality": { type: String, index: true },
    "questionnaire.submitted_at": { type: Date, index: true },
    "doctor_assessment.created_at": { type: Date, index: true }
  },
  loose
);

sessionSchema.index({ participant_id: 1, started_at: -1 });
sessionSchema.index(
  { participant_id: 1, session_code: 1 },
  { unique: true, partialFilterExpression: { participant_id: { $exists: true }, session_code: { $type: "string" } } }
);
sessionSchema.index({ status: 1, started_at: -1 });
sessionSchema.index({ condition: 1, started_at: -1 });

const tokenSchema = new Schema(
  {
    token_hash: { type: String, unique: true },
    purpose: { type: String, index: true },
    participant_id: { type: Schema.Types.ObjectId, ref: "Participant", index: true },
    "payload.email": { type: String, index: true },
    used: { type: Boolean, default: false, index: true },
    expires_at: { type: Date, expires: 0 }
  },
  loose
);

tokenSchema.index({ purpose: 1, "payload.email": 1, used: 1, expires_at: -1 });
tokenSchema.index({ purpose: 1, participant_id: 1, used: 1, expires_at: -1 });

const dashboardAccessRequestSchema = new Schema(
  {
    email: { type: String, index: true },
    status: { type: String, index: true },
    requested_at: { type: Date, index: true }
  },
  loose
);

dashboardAccessRequestSchema.index({ email: 1, status: 1 });

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
