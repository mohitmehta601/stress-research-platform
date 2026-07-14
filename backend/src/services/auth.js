import { Types } from "mongoose";
import { settings } from "../config/settings.js";
import { Participant } from "../models/index.js";
import { hashPassword } from "../utils/security.js";

export function nextStep(participant) {
  if (!participant?.consent_completed) return "consent";
  if (!participant?.profile_completed) return "profile";
  return "dashboard";
}

export function publicParticipant(participant) {
  return {
    id: String(participant._id),
    email: participant.email,
    participant_code: participant.participant_code,
    name: participant.name,
    role: participant.role || "participant",
    consent_completed: Boolean(participant.consent_completed),
    profile_completed: Boolean(participant.profile_completed),
    next_step: nextStep(participant)
  };
}

export async function generateParticipantCode(prefix = "P") {
  const safePrefix = String(prefix || "P").trim().toUpperCase();
  const rows = await Participant.find({ participant_code: { $regex: `^${safePrefix}\\d+$` } }, { participant_code: 1 }).lean();
  let maxNumber = 0;
  for (const row of rows) {
    const number = String(row.participant_code || "").slice(safePrefix.length);
    if (/^\d+$/.test(number)) maxNumber = Math.max(maxNumber, Number.parseInt(number, 10));
  }
  for (;;) {
    maxNumber += 1;
    const candidate = `${safePrefix}${String(maxNumber).padStart(3, "0")}`;
    if (!(await Participant.exists({ participant_code: candidate }))) return candidate;
  }
}

export async function bootstrapResearcher() {
  if (!settings.bootstrapSuperAdminEmail || !settings.bootstrapSuperAdminPassword) return;
  const now = new Date();
  const email = settings.bootstrapSuperAdminEmail.trim().toLowerCase();
  const existing = await Participant.findOne({ email });
  const accountData = {
    email,
    name: settings.bootstrapSuperAdminName,
    password_hash: await hashPassword(settings.bootstrapSuperAdminPassword),
    role: "super_admin",
    is_active: true,
    email_verified: true,
    email_verified_at: now,
    approval_status: "approved",
    approved_at: now,
    consent_completed: true,
    profile_completed: true,
    updated_at: now
  };
  if (existing) {
    if (!String(existing.participant_code || "").startsWith("A")) {
      accountData.participant_code = await generateParticipantCode("A");
    }
    await Participant.updateOne({ _id: existing._id }, { $set: accountData });
    return;
  }
  await Participant.create({
    ...accountData,
    participant_code: await generateParticipantCode("A"),
    created_at: now
  });
}

export function objectIdOrCode(value) {
  return Types.ObjectId.isValid(value) ? { _id: value } : { participant_code: String(value || "").trim().toUpperCase() };
}
