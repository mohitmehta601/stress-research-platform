import express from "express";
import { Types } from "mongoose";
import {
  DashboardAccessRequest,
  DoctorAssessment,
  Notification,
  Participant,
  PasswordResetToken,
  Physiological,
  QuestionnaireResponse,
  ResearchSession
} from "../../models/index.js";
import { settings } from "../../config/settings.js";
import {
  createAccessToken,
  createRefreshToken,
  getParticipantFromRefreshToken,
  requireParticipant,
  requireResearcher,
  requireSuperAdmin,
  setAuthCookie
} from "../../middleware/auth.js";
import {
  generateParticipantCode,
  nextStep,
  objectIdOrCode,
  publicParticipant
} from "../../services/auth.js";
import { sendEmail } from "../../services/email.js";
import { exportCsv, EXPORTS } from "../../services/dataset.js";
import {
  fetchLatestThingSpeakReading,
  fetchThingSpeakReadings,
  normalizeSensorValue,
  normalizePhysiologicalPayload,
  THINGSPEAK_FIELD_DEFS
} from "../../services/thingspeak.js";
import {
  generateOtpCode,
  generateToken,
  hashPassword,
  hashSecret,
  normalizeEmail,
  requireFields,
  verifyPassword
} from "../../utils/security.js";
import { asyncHandler, average, cleanDocument } from "../../utils/format.js";

const router = express.Router();
const participantFilter = { role: "participant" };

function makeError(status, detail) {
  const error = new Error(detail);
  error.status = status;
  error.detail = detail;
  return error;
}

function sensorAverage(items, key, aliases = []) {
  const keys = [key, ...aliases];
  const values = items
    .map((item) => {
      const rawValue = keys.map((candidate) => item?.[candidate]).find((value) => value !== null && value !== undefined);
      return normalizeSensorValue(key, rawValue);
    })
    .filter((value) => typeof value === "number");

  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
}

function tokenPayload(participant) {
  return {
    access_token: createAccessToken(participant._id),
    refresh_token: createRefreshToken(participant._id),
    participant: publicParticipant(participant)
  };
}

async function createNotification(type, title, message, relatedId = null) {
  await Notification.create({
    type,
    title,
    message,
    related_id: relatedId,
    created_at: new Date(),
    read: false
  });
}

async function sendPasswordResetEmail(participant, token) {
  const base = participant.role === "participant"
    ? settings.mobileUrl.replace(/\/$/, "")
    : `${settings.frontendUrl.replace(/\/$/, "")}/researcher/login`;
  const query = new URLSearchParams({ resetToken: token, email: participant.email }).toString();
  const link = `${base}?${query}`;
  const name = participant.name || "there";
  await sendEmail({
    toEmail: participant.email,
    toName: participant.name,
    subject: "Reset your Stress Research Platform password",
    text: `Hello ${name},\n\nUse this link within 30 minutes to reset your password:\n\n${link}`,
    html: `<p>Hello ${name},</p><p>Use this link within 30 minutes to reset your password.</p><p><a href="${link}">Reset password</a></p>`
  });
}

async function createOtpChallenge({ email, name, purpose, payload = null, participantId = null }) {
  const code = generateOtpCode();
  const otpToken = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.otpExpiryMinutes * 60 * 1000);
  await PasswordResetToken.create({
    purpose,
    token_hash: hashSecret(otpToken),
    otp_hash: hashSecret(code),
    used: false,
    created_at: now,
    expires_at: expiresAt,
    ...(participantId ? { participant_id: participantId } : {}),
    ...(payload ? { payload } : {})
  });
  if (!settings.otpDevMode) {
    await sendEmail({
      toEmail: email,
      toName: name,
      subject: "Verification code",
      text: `Your Stress Research Platform verification code is ${code}. It expires in ${settings.otpExpiryMinutes} minutes.`,
      html: `<p>Your Stress Research Platform verification code is <strong>${code}</strong>.</p><p>This code expires in ${settings.otpExpiryMinutes} minutes.</p>`
    });
  }
  return {
    requires_otp: true,
    otp_token: otpToken,
    email,
    expires_in_minutes: settings.otpExpiryMinutes,
    expires_in_seconds: settings.otpExpiryMinutes * 60,
    expires_at: expiresAt.toISOString(),
    message: settings.otpDevMode ? "Development OTP generated." : "Verification code sent to your email.",
    ...(settings.otpDevMode ? { dev_otp: code, otp_code: code } : {})
  };
}

async function createEmailOtpChallenge({ email, name, purpose }) {
  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.otpExpiryMinutes * 60 * 1000);
  await PasswordResetToken.updateMany({
    purpose,
    "payload.email": normalizeEmail(email),
    used: false
  }, {
    $set: { used: true, used_at: now, replaced_at: now }
  });
  await PasswordResetToken.create({
    purpose,
    token_hash: hashSecret(generateToken()),
    otp_hash: hashSecret(code),
    used: false,
    payload: { email },
    created_at: now,
    expires_at: expiresAt
  });
  let emailResult;
  if (settings.otpDevMode) {
    emailResult = { status: "skipped" };
  } else {
    emailResult = await sendEmail({
      toEmail: email,
      toName: name,
      subject: "Verification code",
      text: `Your Stress Research Platform verification code is ${code}. It expires in ${settings.otpExpiryMinutes} minutes.`,
      html: `<p>Your Stress Research Platform verification code is <strong>${code}</strong>.</p><p>This code expires in ${settings.otpExpiryMinutes} minutes.</p>`
    });
  }
  return {
    success: true,
    message: settings.otpDevMode ? "Development OTP generated." : "OTP sent to your email.",
    email,
    expires_in_minutes: settings.otpExpiryMinutes,
    expires_in_seconds: settings.otpExpiryMinutes * 60,
    expires_at: expiresAt.toISOString(),
    ...(settings.otpDevMode && emailResult?.status === "skipped" ? { dev_otp: code, otp_code: code } : {})
  };
}

async function findValidOtp(purpose, otpToken, otpCode) {
  const record = await PasswordResetToken.findOne({
    purpose,
    token_hash: hashSecret(otpToken),
    used: false,
    expires_at: { $gt: new Date() }
  }).lean();
  if (!record || record.otp_hash !== hashSecret(otpCode)) {
    throw makeError(400, "Invalid or expired verification code");
  }
  return record;
}

async function findValidEmailOtp(purpose, email, otpCode) {
  const record = await PasswordResetToken.findOne({
    purpose,
    "payload.email": normalizeEmail(email),
    used: false,
    expires_at: { $gt: new Date() }
  }).sort({ created_at: -1 }).lean();
  if (!record || record.otp_hash !== hashSecret(otpCode)) {
    throw makeError(400, "Invalid or expired OTP");
  }
  return record;
}

function profileFromManualPayload(payload, participantId) {
  const height = payload.height_cm ?? null;
  const weight = payload.weight_kg ?? null;
  return {
    participant_id: participantId,
    age: payload.age ?? null,
    gender: payload.gender ?? null,
    height_cm: height,
    weight_kg: weight,
    bmi: height && weight ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null,
    education: payload.education ?? null,
    occupation: payload.occupation ?? null,
    smoking: payload.smoking ?? null,
    alcohol: payload.alcohol ?? null,
    sleep_hours: payload.sleep_hours ?? null,
    exercise_days_per_week: payload.exercise_days_per_week ?? null,
    heart_disease: Boolean(payload.heart_disease),
    hypertension: Boolean(payload.hypertension),
    diabetes: Boolean(payload.diabetes),
    medication: payload.medication ?? null
  };
}

function publicParticipantRow(person, sessions = 0, completed = 0, latest = null) {
  const profile = person.profile || {};
  return {
    id: String(person._id),
    participant_code: person.participant_code || "",
    name: person.name || "",
    email: person.email || "",
    sessions,
    completed_sessions: completed,
    consent_completed: Boolean(person.consent_completed),
    profile_completed: Boolean(person.profile_completed),
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    height_cm: profile.height_cm ?? null,
    weight_kg: profile.weight_kg ?? null,
    bmi: profile.bmi ?? null,
    education: profile.education ?? null,
    occupation: profile.occupation ?? null,
    smoking: profile.smoking ?? null,
    alcohol: profile.alcohol ?? null,
    sleep_hours: profile.sleep_hours ?? null,
    exercise_days_per_week: profile.exercise_days_per_week ?? null,
    heart_disease: Boolean(profile.heart_disease),
    hypertension: Boolean(profile.hypertension),
    diabetes: Boolean(profile.diabetes),
    medication: profile.medication ?? null,
    last_session_at: latest?.started_at ?? null,
    is_active: person.is_active !== false
  };
}

function publicPhysiological(item = null) {
  if (!item) return null;
  return {
    heart_rate: item.heart_rate,
    hrv: item.hrv,
    eda: item.eda,
    temperature: item.temperature,
    respiration: item.respiration,
    mean_temp: item.mean_temp ?? item.temperature,
    rmssd_ms: item.rmssd_ms ?? item.hrv,
    sdnn_ms: item.sdnn_ms,
    heart_rate_bpm: item.heart_rate_bpm ?? item.heart_rate,
    spo2_percent: item.spo2_percent,
    scl_us: item.scl_us ?? item.eda,
    scr_peak_count: item.scr_peak_count,
    scr_mean: item.scr_mean,
    sensor_fields: item.sensor_fields || THINGSPEAK_FIELD_DEFS.map((def) => ({
      name: def.name,
      key: def.key,
      field: def.field,
      value: item[def.key] ?? (def.alias ? item[def.alias] : null) ?? null,
      unit: def.unit
    })),
    thingspeak: item.thingspeak || null,
    recorded_at: item.recorded_at || null,
    signal_quality: item.signal_quality || "pending",
    series: Array.isArray(item.series) ? item.series.map((point) => ({
      recorded_at: point.recorded_at || null,
      entry_id: point.entry_id ?? point.thingspeak?.entry_id ?? null,
      sensor_fields: point.sensor_fields || THINGSPEAK_FIELD_DEFS.map((def) => ({
        name: def.name,
        key: def.key,
        field: def.field,
        value: point[def.key] ?? (def.alias ? point[def.alias] : null) ?? null,
        unit: def.unit
      }))
    })) : []
  };
}

async function resolveParticipant(participantId) {
  const participant = await Participant.findOne({ ...objectIdOrCode(participantId), ...participantFilter }).lean();
  if (!participant) throw makeError(404, "Participant not found");
  return participant;
}

async function publicSessionRow(item) {
  const person = item.participant_id ? await Participant.findById(item.participant_id).lean() : null;
  const physiological = item.physiological || null;
  const questionnaire = item.questionnaire || null;
  const assessment = item.doctor_assessment || null;
  return {
    ...item,
    _id: String(item._id),
    id: String(item._id),
    participant_id: String(item.participant_id || ""),
    participant_object_id: String(item.participant_id || ""),
    participant_code: person?.participant_code || "Unknown",
    participant_name: person?.name || "Unknown participant",
    physiological: publicPhysiological(physiological),
    signal_quality: physiological?.signal_quality || item.signal_quality || "pending",
    collected: {
      physiological: Boolean(physiological),
      questionnaire: Boolean(questionnaire),
      doctor_assessment: Boolean(assessment)
    },
    stress_score: questionnaire?.score,
    doctor_label: assessment?.clinical_stress
  };
}

function publicSession(document) {
  return {
    id: String(document._id),
    session_code: document.session_code || String(document._id),
    participant_id: String(document.participant_id),
    condition: document.condition,
    status: document.status,
    task: document.task,
    started_at: document.started_at,
    completed_at: document.completed_at,
    duration_seconds: document.duration_seconds
  };
}

async function nextSessionCode(participantId) {
  const sessions = await ResearchSession.find({ participant_id: participantId }).select("session_code").lean();
  const used = new Set(sessions.map((session) => String(session.session_code || "").toUpperCase()));
  for (let index = sessions.length + 1; index < sessions.length + 500; index += 1) {
    const code = `S${String(index).padStart(2, "0")}`;
    if (!used.has(code)) return code;
  }
  return `S${Date.now()}`;
}

function hasFilledQuestionnaireAnswers(questionnaire) {
  return Boolean(
    questionnaire
    && questionnaire.answers
    && typeof questionnaire.answers === "object"
    && Object.keys(questionnaire.answers).length > 0
  );
}

async function upsertQuestionnaireResponse(session, questionnaire) {
  if (!hasFilledQuestionnaireAnswers(questionnaire)) {
    await QuestionnaireResponse.deleteOne({ session_id: session._id });
    return;
  }

  const submittedAt = questionnaire.submitted_at || new Date();
  await QuestionnaireResponse.updateOne(
    { session_id: session._id },
    {
      $set: {
        participant_id: session.participant_id,
        participant_code: session.participant_code,
        session_id: session._id,
        session_code: session.session_code,
        condition: questionnaire.condition || session.condition,
        questionnaire_key: questionnaire.questionnaire_key || "post-session-v1",
        answers: questionnaire.answers || {},
        score: questionnaire.score ?? null,
        submitted_at: submittedAt,
        updated_at: questionnaire.updated_at || submittedAt
      },
      $setOnInsert: {
        created_at: submittedAt
      }
    },
    { upsert: true }
  );
}

function hasPhysiologicalValues(physiological) {
  return Boolean(
    physiological
    && THINGSPEAK_FIELD_DEFS.some((def) => typeof physiological[def.key] === "number")
  );
}

async function upsertPhysiologicalRecord(session, physiological) {
  if (!hasPhysiologicalValues(physiological)) {
    await Physiological.deleteOne({ session_id: session._id });
    return;
  }

  const participant = await Participant.findById(session.participant_id).lean();
  const recordedAt = physiological.recorded_at ? new Date(physiological.recorded_at) : new Date();
  const record = {
    ...physiological,
    participant_id: session.participant_id,
    participant_code: participant?.participant_code || session.participant_code || "",
    session_id: session._id,
    session_code: session.session_code,
    condition: physiological.condition || session.condition,
    thingspeak_entry_id: physiological.thingspeak?.entry_id ?? physiological.thingspeak_entry_id ?? null,
    recorded_at: recordedAt,
    updated_at: physiological.updated_at || new Date()
  };

  await Physiological.updateOne(
    { session_id: session._id },
    {
      $set: record,
      $setOnInsert: {
        created_at: recordedAt
      }
    },
    { upsert: true }
  );
}

async function upsertDoctorAssessment(session, assessment) {
  if (!assessment?.clinical_stress && !assessment?.clinical_stress_label) {
    await DoctorAssessment.deleteOne({ session_id: session._id });
    return;
  }

  const participant = await Participant.findById(session.participant_id).lean();
  const createdAt = assessment.created_at ? new Date(assessment.created_at) : new Date();
  const clinicalStress = String(assessment.clinical_stress || assessment.clinical_stress_label || "").toLowerCase();

  await DoctorAssessment.updateOne(
    { session_id: session._id },
    {
      $set: {
        participant_id: session.participant_id,
        participant_code: participant?.participant_code || session.participant_code || "",
        session_id: session._id,
        session_code: session.session_code,
        condition: session.condition,
        clinical_stress: clinicalStress,
        clinical_stress_label: clinicalStress,
        comments: assessment.comments ?? null,
        recommendation: assessment.recommendation ?? null,
        status: "completed",
        created_at: createdAt,
        updated_at: assessment.updated_at || new Date()
      },
      $setOnInsert: {
        inserted_at: createdAt
      }
    },
    { upsert: true }
  );
}

async function syncManualSessionChildren(session, payload) {
  const now = new Date();
  const set = { updated_at: now };
  const unset = {};
  if (payload.ecg_collected || [payload.heart_rate, payload.hrv, payload.eda, payload.temperature, payload.respiration, payload.sdnn_ms, payload.spo2_percent, payload.scr_peak_count, payload.scr_mean].some((value) => value !== null && value !== undefined)) {
    const physiological = normalizePhysiologicalPayload({
      heart_rate: payload.heart_rate ?? null,
      hrv: payload.hrv ?? null,
      eda: payload.eda ?? null,
      temperature: payload.temperature ?? null,
      respiration: payload.respiration ?? null,
      mean_temp: payload.mean_temp ?? payload.temperature ?? null,
      rmssd_ms: payload.rmssd_ms ?? payload.hrv ?? null,
      sdnn_ms: payload.sdnn_ms ?? null,
      heart_rate_bpm: payload.heart_rate_bpm ?? payload.heart_rate ?? null,
      spo2_percent: payload.spo2_percent ?? null,
      scl_us: payload.scl_us ?? payload.eda ?? null,
      scr_peak_count: payload.scr_peak_count ?? null,
      scr_mean: payload.scr_mean ?? null,
      signal_quality: payload.signal_quality || "good"
    });
    set.physiological = {
      ...physiological,
      condition: payload.condition,
      ecg: payload.ecg_collected ? [] : null,
      respiration: payload.respiration ?? null,
      recorded_at: payload.started_at ? new Date(payload.started_at) : now,
      updated_at: now
    };
    set.signal_quality = set.physiological.signal_quality;
  } else {
    unset.physiological = "";
    set.signal_quality = "pending";
  }
  if (payload.questionnaire_completed) {
    const existingQuestionnaire = session.questionnaire || {};
    set.questionnaire = {
      condition: payload.condition,
      questionnaire_key: payload.questionnaire_key || existingQuestionnaire.questionnaire_key || "manual-dashboard-v1",
      answers: existingQuestionnaire.answers || {},
      score: payload.questionnaire_score ?? null,
      submitted_at: existingQuestionnaire.submitted_at || (payload.completed_at ? new Date(payload.completed_at) : payload.started_at ? new Date(payload.started_at) : now),
      updated_at: now
    };
  } else {
    unset.questionnaire = "";
  }
  if (payload.doctor_assessment_completed) {
    set.doctor_assessment = {
      clinical_stress: payload.doctor_label,
      comments: "Manual dashboard entry",
      recommendation: null,
      created_at: payload.completed_at ? new Date(payload.completed_at) : payload.started_at ? new Date(payload.started_at) : now,
      updated_at: now
    };
  } else {
    unset.doctor_assessment = "";
  }
  await ResearchSession.updateOne({ _id: session._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  await upsertPhysiologicalRecord(session, set.physiological || null);
  await upsertQuestionnaireResponse(session, set.questionnaire || null);
  await upsertDoctorAssessment(session, set.doctor_assessment || null);
}

router.get("/", (_req, res) => res.json({ status: "ok", database: "mongodb" }));

router.post("/participant/request-otp", asyncHandler(async (req, res) => {
  requireFields(req.body, ["email"]);
  const email = normalizeEmail(req.body.email);
  const existing = await Participant.findOne({ email }).lean();
  if (existing && existing.email_verified !== false) {
    throw makeError(409, "An account with this email already exists. Please log in.");
  }
  res.json(await createEmailOtpChallenge({
    email,
    name: req.body.name || "Participant",
    purpose: "participant_signup"
  }));
}));

router.post("/participant/register", asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password", "otp_code"]);
  const email = normalizeEmail(req.body.email);
  const existing = await Participant.findOne({ email }).lean();
  if (existing && existing.email_verified !== false) {
    throw makeError(409, "An account with this email already exists. Please log in.");
  }
  const record = await findValidEmailOtp("participant_signup", email, req.body.otp_code || req.body.otpCode);
  const now = new Date();
  const document = {
    email,
    name: String(req.body.name || email.split("@")[0] || "Participant").trim(),
    participant_code: existing?.participant_code || await generateParticipantCode("P"),
    password_hash: await hashPassword(req.body.password),
    is_active: true,
    role: "participant",
    email_verified: true,
    email_verified_at: now,
    approval_status: "approved",
    consent_completed: false,
    profile_completed: false,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  let participant;
  if (existing) {
    await Participant.updateOne({ _id: existing._id }, { $set: document });
    participant = await Participant.findById(existing._id).lean();
  } else {
    participant = await Participant.create(document);
  }
  await PasswordResetToken.updateOne({ _id: record._id }, { $set: { used: true, used_at: now } });
  const payload = tokenPayload(participant);
  setAuthCookie(res, payload);
  res.status(201).json(payload);
}));

router.post("/auth/register", asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "name", "password"]);
  const email = normalizeEmail(req.body.email);
  const now = new Date();
  const document = {
    email,
    name: String(req.body.name).trim(),
    participant_code: await generateParticipantCode("P"),
    password_hash: await hashPassword(req.body.password),
    is_active: true,
    role: "participant",
    email_verified: false,
    approval_status: "approved",
    consent_completed: false,
    profile_completed: false,
    created_at: now,
    updated_at: now
  };
  const existing = await Participant.findOne({ email });
  if (existing) {
    if (existing.email_verified === false) {
      await Participant.updateOne({ _id: existing._id }, { $set: { ...document, participant_code: existing.participant_code, created_at: existing.created_at || now } });
      return res.status(201).json(await createOtpChallenge({ email, name: document.name, purpose: "registration_otp", participantId: existing._id }));
    }
    throw makeError(409, "An account with this email already exists");
  }
  const participant = await Participant.create(document);
  res.status(201).json(await createOtpChallenge({ email, name: document.name, purpose: "registration_otp", participantId: participant._id }));
}));

router.post("/auth/verify-registration-otp", asyncHandler(async (req, res) => {
  const record = await findValidOtp("registration_otp", req.body.otp_token, req.body.otp_code);
  const participant = await Participant.findById(record.participant_id).lean();
  if (!participant || participant.is_active === false) throw makeError(400, "Invalid or expired verification code");
  await PasswordResetToken.updateOne({ _id: record._id }, { $set: { used: true, used_at: new Date() } });
  await Participant.updateOne({ _id: participant._id }, { $set: { email_verified: true, updated_at: new Date() } });
  const payload = tokenPayload({ ...participant, email_verified: true });
  setAuthCookie(res, payload);
  res.json(payload);
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password"]);
  const participant = await Participant.findOne({ email: normalizeEmail(req.body.email) }).lean();
  if (!participant || !(await verifyPassword(req.body.password, participant.password_hash))) {
    throw makeError(401, "Incorrect email or password");
  }
  if (participant.is_active === false) throw makeError(403, "This account is inactive");
  if (participant.role !== "participant" && participant.role !== "super_admin" && (participant.approval_status || "approved") !== "approved") {
    throw makeError(403, "Your dashboard access request has not been approved");
  }
  const payload = tokenPayload(participant);
  payload.user = payload.participant;
  setAuthCookie(res, payload);
  res.json(payload);
}));

router.post("/auth/refresh", asyncHandler(async (req, res) => {
  const participant = await getParticipantFromRefreshToken(req.body.refresh_token);
  if (!participant) throw makeError(401, "Invalid or expired refresh token");
  const payload = tokenPayload(participant);
  setAuthCookie(res, payload);
  res.json(payload);
}));

router.post("/auth/forgot-password", asyncHandler(async (req, res) => {
  const participant = await Participant.findOne({ email: normalizeEmail(req.body.email) }).lean();
  if (participant && participant.is_active !== false) {
    const token = generateToken();
    const now = new Date();
    await PasswordResetToken.create({
      participant_id: participant._id,
      token_hash: hashSecret(token),
      used: false,
      created_at: now,
      expires_at: new Date(now.getTime() + 30 * 60 * 1000)
    });
    await sendPasswordResetEmail(participant, token);
  }
  res.json({ status: "accepted", message: "If this email exists, password reset instructions will be sent." });
}));

router.post("/auth/reset-password", asyncHandler(async (req, res) => {
  requireFields(req.body, ["token", "password"]);
  const reset = await PasswordResetToken.findOne({ token_hash: hashSecret(req.body.token), used: false, expires_at: { $gt: new Date() } }).lean();
  if (!reset) throw makeError(400, "This password reset link is invalid or expired");
  const participant = await Participant.findById(reset.participant_id).lean();
  if (!participant || participant.is_active === false) throw makeError(400, "This password reset link is invalid or expired");
  await Participant.updateOne({ _id: participant._id }, { $set: { password_hash: await hashPassword(req.body.password), updated_at: new Date() } });
  await PasswordResetToken.updateOne({ _id: reset._id }, { $set: { used: true, used_at: new Date() } });
  res.json({ status: "updated", message: "Your password has been updated." });
}));

router.post("/auth/dashboard-access-requests", asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "email", "organization", "requestedRole", "reason"]);
  const email = normalizeEmail(req.body.email);
  const existingAccount = await Participant.exists({ email, role: { $in: ["viewer", "researcher", "doctor", "admin", "super_admin"] } });
  if (existingAccount) throw makeError(409, "An account with dashboard access already exists");
  const existingRequest = await DashboardAccessRequest.exists({ email, status: { $in: ["pending", "approved"] } });
  if (existingRequest) throw makeError(409, "An active access request already exists for this email");
  const payload = {
    name: String(req.body.name).trim(),
    email,
    organization: String(req.body.organization).trim(),
    requested_role: req.body.requestedRole || req.body.requested_role || "viewer",
    reason: String(req.body.reason).trim()
  };
  res.status(201).json(await createOtpChallenge({ email, name: payload.name, purpose: "dashboard_access_otp", payload }));
}));

router.post("/auth/dashboard-access-requests/verify-otp", asyncHandler(async (req, res) => {
  const record = await findValidOtp("dashboard_access_otp", req.body.otp_token, req.body.otp_code);
  const pending = record.payload || {};
  const email = normalizeEmail(pending.email);
  if (!email) throw makeError(400, "Invalid or expired verification code");
  const existing = await DashboardAccessRequest.exists({ email, status: { $in: ["pending", "approved"] } });
  if (existing) throw makeError(409, "An active access request already exists for this email");
  const now = new Date();
  const request = await DashboardAccessRequest.create({
    request_code: `AR-${generateToken(5).replace(/[^a-z0-9]/gi, "").toUpperCase()}`,
    name: pending.name,
    email,
    organization: pending.organization,
    requested_role: pending.requested_role || "viewer",
    reason: pending.reason,
    status: "pending",
    email_verified: true,
    email_verified_at: now,
    requested_at: now,
    created_at: now,
    updated_at: now
  });
  await PasswordResetToken.updateOne({ _id: record._id }, { $set: { used: true, used_at: now } });
  res.status(201).json({ id: String(request._id), request_code: request.request_code, status: request.status, message: "Your dashboard access request has been submitted successfully." });
}));

router.get("/auth/me", requireParticipant, (req, res) => res.json(publicParticipant(req.participant)));

router.get("/profiles/onboarding", requireParticipant, (req, res) => {
  res.json({
    participant_id: String(req.participant._id),
    participant_code: req.participant.participant_code,
    consent_completed: Boolean(req.participant.consent_completed),
    profile_completed: Boolean(req.participant.profile_completed),
    next_step: nextStep(req.participant)
  });
});

router.get("/profiles/me", requireParticipant, (req, res) => {
  if (!req.participant.profile) return res.status(404).json({ detail: "Profile has not been completed" });
  res.json({ ...req.participant.profile, participant_id: String(req.participant._id) });
});

router.put("/profiles/me", requireParticipant, asyncHandler(async (req, res) => {
  if (!req.participant.consent_completed) throw makeError(403, "Research consent is required first");
  const now = new Date();
  const height = Number(req.body.height_cm);
  const weight = Number(req.body.weight_kg);
  const profile = {
    ...req.body,
    bmi: Math.round((weight / ((height / 100) ** 2)) * 10) / 10,
    updated_at: now
  };
  await Participant.updateOne({ _id: req.participant._id }, { $set: { profile, profile_completed: true, updated_at: now } });
  res.json({ ...profile, participant_id: String(req.participant._id) });
}));

router.get("/consents/current", requireParticipant, (req, res) => {
  const consent = req.participant.consent;
  if (!consent || consent.version !== settings.consentVersion) return res.status(404).json({ detail: "No consent decision has been recorded" });
  res.json({ ...consent, participant_id: String(req.participant._id) });
});

router.post("/consents/decision", requireParticipant, asyncHandler(async (req, res) => {
  const recordedAt = new Date();
  const consent = { version: settings.consentVersion, accepted: Boolean(req.body.accepted), recorded_at: recordedAt };
  await Participant.updateOne({ _id: req.participant._id }, { $set: { consent, consent_completed: Boolean(req.body.accepted), updated_at: recordedAt } });
  res.status(201).json({ ...consent, participant_id: String(req.participant._id) });
}));

router.get("/sessions/status", (_req, res) => res.json({ service: "sessions", status: "ready" }));

router.get("/sessions/thingspeak/latest", requireParticipant, asyncHandler(async (_req, res) => {
  const latest = await fetchLatestThingSpeakReading();
  res.json(publicPhysiological(latest));
}));

router.post("/sessions", requireParticipant, asyncHandler(async (req, res) => {
  if (req.participant.role !== "participant") throw makeError(403, "Participant access is required");
  if (!req.participant.consent_completed || !req.participant.profile_completed) throw makeError(403, "Consent and profile are required before sessions");
  if (!["relaxed", "stress"].includes(req.body.condition)) throw makeError(400, "Session condition is required");

  const existing = await ResearchSession.findOne({
    participant_id: req.participant._id,
    condition: req.body.condition,
    status: { $in: ["in_progress", "in-progress", "pending"] }
  }).sort({ started_at: -1 }).lean();
  if (existing) return res.json(publicSession(existing));

  const now = new Date();
  const session = await ResearchSession.create({
    participant_id: req.participant._id,
    session_code: await nextSessionCode(req.participant._id),
    condition: req.body.condition,
    task: req.body.task,
    status: "in_progress",
    started_at: now,
    created_at: now,
    updated_at: now
  });
  await createNotification("research_session_created", "New research session created", `${session.session_code} started by ${req.participant.participant_code || "participant"}.`, session._id);
  res.status(201).json(publicSession(session));
}));

router.post("/sessions/complete-flow", requireParticipant, asyncHandler(async (req, res) => {
  if (req.participant.role !== "participant") throw makeError(403, "Participant access is required");
  if (!req.participant.consent_completed || !req.participant.profile_completed) throw makeError(403, "Consent and profile are required before sessions");
  if (!["relaxed", "stress"].includes(req.body.condition)) throw makeError(400, "Session condition is required");
  if (!hasFilledQuestionnaireAnswers({ answers: req.body.questionnaire?.answers })) throw makeError(400, "Complete questionnaire answers are required before saving a session");

  const now = new Date();
  const questionnaireValues = Object.values(req.body.questionnaire.answers || {}).filter((value) => typeof value === "number");
  const score = req.body.questionnaire.score ?? (questionnaireValues.length ? Math.round(questionnaireValues.reduce((sum, value) => sum + value, 0) * 100) / 100 : null);
  let physiological = null;

  if (req.body.physiological_collected) {
    const latest = await fetchLatestThingSpeakReading();
    physiological = {
      ...latest,
      condition: req.body.condition,
      recorded_at: latest.recorded_at ? new Date(latest.recorded_at) : now,
      updated_at: now
    };
  }

  const questionnaire = {
    condition: req.body.condition,
    questionnaire_key: req.body.questionnaire.questionnaire_key || "msaq-v1",
    answers: req.body.questionnaire.answers,
    score,
    submitted_at: now,
    updated_at: now
  };

  const session = await ResearchSession.create({
    participant_id: req.participant._id,
    session_code: await nextSessionCode(req.participant._id),
    condition: req.body.condition,
    task: req.body.task,
    status: "completed",
    started_at: now,
    completed_at: now,
    duration_seconds: 0,
    signal_quality: physiological?.signal_quality || "pending",
    physiological,
    questionnaire,
    created_at: now,
    updated_at: now
  });

  await upsertPhysiologicalRecord(session, physiological);
  await upsertQuestionnaireResponse(session, questionnaire);
  await createNotification("research_session_completed", "Research session completed", `${session.session_code} completed by ${req.participant.participant_code || "participant"}.`, session._id);
  res.status(201).json(publicSession(session));
}));

router.get("/sessions/me", requireParticipant, asyncHandler(async (req, res) => {
  const sessions = await ResearchSession.find({ participant_id: req.participant._id }).sort({ started_at: -1 }).lean();
  res.json(sessions.map((item) => ({
    ...publicSession(item),
    signal_quality: item.physiological?.signal_quality || item.signal_quality || "pending",
    collected: {
      physiological: Boolean(item.physiological),
      questionnaire: Boolean(item.questionnaire),
      doctor_assessment: Boolean(item.doctor_assessment)
    },
    physiological: publicPhysiological(item.physiological)
  })));
}));

router.post("/sessions/:sessionId/physiological", requireParticipant, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findOne({ _id: req.params.sessionId, participant_id: req.participant._id }).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const physiological = normalizePhysiologicalPayload({
    ...req.body,
    condition: session.condition,
    recorded_at: now,
    updated_at: now
  });
  await ResearchSession.updateOne({ _id: session._id }, {
    $set: {
      physiological,
      signal_quality: physiological.signal_quality || "good",
      updated_at: now
    }
  });
  await upsertPhysiologicalRecord(session, physiological);
  await createNotification("physiological_data_uploaded", "Physiological data uploaded", `Sensor readings saved for ${session.session_code || req.params.sessionId}.`, session._id);
  res.status(201).json({ status: "saved", session_id: req.params.sessionId, physiological: publicPhysiological(physiological) });
}));

router.post("/sessions/:sessionId/thingspeak-sync", requireParticipant, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findOne({ _id: req.params.sessionId, participant_id: req.participant._id }).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const series = await fetchThingSpeakReadings({ minutes: req.body.duration_minutes ?? 5 });
  const latest = series[series.length - 1] || await fetchLatestThingSpeakReading();
  const physiological = {
    ...latest,
    series,
    condition: session.condition,
    recorded_at: latest.recorded_at ? new Date(latest.recorded_at) : now,
    updated_at: now
  };
  await ResearchSession.updateOne({ _id: session._id }, {
    $set: {
      physiological,
      signal_quality: physiological.signal_quality || "good",
      updated_at: now
    }
  });
  await upsertPhysiologicalRecord(session, physiological);
  await createNotification("thingspeak_data_synced", "ThingSpeak sensor data synced", `ThingSpeak readings saved for ${session.session_code || req.params.sessionId}.`, session._id);
  res.status(201).json({ status: "synced", session_id: req.params.sessionId, physiological: publicPhysiological(physiological) });
}));

router.post("/sessions/:sessionId/complete", requireParticipant, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findOne({ _id: req.params.sessionId, participant_id: req.participant._id }).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const duration = session.started_at ? Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000) : null;
  await ResearchSession.updateOne({ _id: session._id }, { $set: { status: "completed", completed_at: now, duration_seconds: duration, updated_at: now } });
  const updated = await ResearchSession.findById(session._id).lean();
  res.json(publicSession(updated));
}));

router.get("/questionnaires/status", (_req, res) => res.json({ service: "questionnaires", status: "ready" }));

router.post("/questionnaires", requireParticipant, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.body.session_id)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findOne({ _id: req.body.session_id, participant_id: req.participant._id }).lean();
  if (!session) throw makeError(404, "Session not found");
  const values = Object.values(req.body.answers || {}).filter((value) => typeof value === "number");
  const score = req.body.score ?? (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100 : null);
  const now = new Date();
  const questionnaire = {
    condition: session.condition,
    questionnaire_key: req.body.questionnaire_key || "post-session-v1",
    answers: req.body.answers || {},
    score,
    submitted_at: now,
    updated_at: now
  };
  await ResearchSession.updateOne({ _id: session._id }, { $set: { questionnaire, updated_at: now } });
  await upsertQuestionnaireResponse(session, questionnaire);
  await createNotification("questionnaire_submitted", "Questionnaire submitted", `Questionnaire response saved for ${session.session_code || req.body.session_id}.`, session._id);
  res.status(201).json({ status: "saved", session_id: req.body.session_id, score, submitted_at: now });
}));

router.get("/doctors/status", (_req, res) => res.json({ service: "doctors", status: "ready" }));

router.post("/doctors/assessments", requireParticipant, requireResearcher, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.body.session_id)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findById(req.body.session_id).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const document = {
    clinical_stress: String(req.body.clinical_stress || "").toLowerCase(),
    comments: req.body.comments,
    recommendation: req.body.recommendation,
    created_at: now,
    updated_at: now
  };
  await ResearchSession.updateOne({ _id: session._id }, { $set: { doctor_assessment: document, updated_at: now } });
  await upsertDoctorAssessment(session, document);
  await createNotification("doctor_assessment_completed", "Doctor assessment completed", `Clinical label saved for ${session.session_code || req.body.session_id}.`, session._id);
  res.status(201).json({ status: "saved", session_id: req.body.session_id, clinical_stress: document.clinical_stress });
}));

router.get("/doctors/assessments/:sessionId", requireParticipant, requireResearcher, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findById(req.params.sessionId).lean();
  if (!session?.doctor_assessment) throw makeError(404, "Doctor assessment not found");
  res.json({ id: req.params.sessionId, session_id: req.params.sessionId, participant_id: String(session.participant_id || ""), ...session.doctor_assessment });
}));

router.use("/dashboard", requireParticipant, requireResearcher);

router.get("/dashboard/summary", asyncHandler(async (_req, res) => {
  const [participants, totalSessions, completed, assessments, consented, sensorRecords, questionnaireRecords, recent, completedSessions] = await Promise.all([
    Participant.countDocuments(participantFilter),
    ResearchSession.countDocuments({}),
    ResearchSession.countDocuments({ status: "completed" }),
    DoctorAssessment.countDocuments({}),
    Participant.countDocuments({ ...participantFilter, consent_completed: true }),
    Physiological.countDocuments({}),
    QuestionnaireResponse.countDocuments({}),
    ResearchSession.find({}).sort({ started_at: -1 }).lean(),
    ResearchSession.find({ status: "completed" }).lean()
  ]);
  const [physiological, questionnaires] = await Promise.all([
    Physiological.find({}).lean(),
    QuestionnaireResponse.find({}).lean()
  ]);
  const required = participants * 2;
  const byParticipant = new Map();
  for (const session of completedSessions) {
    if (["relaxed", "stress"].includes(session.condition)) {
      const key = String(session.participant_id);
      if (!byParticipant.has(key)) byParticipant.set(key, new Set());
      byParticipant.get(key).add(session.condition);
    }
  }
  const completedSlots = [...byParticipant.values()].reduce((sum, set) => sum + set.size, 0);
  const people = await Participant.find({ _id: { $in: recent.map((item) => item.participant_id).filter(Boolean) } }).lean();
  const codes = new Map(people.map((item) => [String(item._id), item.participant_code || ""]));
  res.json({
    metrics: {
      participants,
      total_sessions: totalSessions,
      completed_sessions: completed,
      pending_reviews: Math.max(completed - assessments, 0),
      consented,
      sensor_records: sensorRecords,
      questionnaire_records: questionnaireRecords,
      required_protocol_slots: required,
      completed_protocol_slots: completedSlots
    },
    averages: {
      heart_rate: sensorAverage(physiological, "heart_rate_bpm", ["heart_rate"]),
      hrv: sensorAverage(physiological, "rmssd_ms", ["hrv"]),
      temperature: sensorAverage(physiological, "mean_temp", ["temperature"]),
      eda: sensorAverage(physiological, "scl_us", ["eda"]),
      sdnn_ms: sensorAverage(physiological, "sdnn_ms"),
      spo2_percent: sensorAverage(physiological, "spo2_percent"),
      scr_peak_count: sensorAverage(physiological, "scr_peak_count"),
      scr_mean: sensorAverage(physiological, "scr_mean"),
      stress_score: average(questionnaires, "score")
    },
    recent_sessions: recent.map((item) => ({
      id: String(item._id),
      session_code: item.session_code || String(item._id),
      participant_code: codes.get(String(item.participant_id)) || "Unknown",
      condition: item.condition || "",
      status: item.status || "",
      started_at: item.started_at,
      signal_quality: item.signal_quality || "pending"
    }))
  });
}));

router.get("/dashboard/participants", asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const query = search ? {
    $and: [
      participantFilter,
      { $or: ["participant_code", "name", "email"].map((field) => ({ [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } })) }
    ]
  } : participantFilter;
  const people = await Participant.find(query).sort({ created_at: -1 }).lean();
  const rows = [];
  for (const person of people) {
    const [sessions, completed, latest] = await Promise.all([
      ResearchSession.countDocuments({ participant_id: person._id }),
      ResearchSession.countDocuments({ participant_id: person._id, status: "completed" }),
      ResearchSession.findOne({ participant_id: person._id }).sort({ started_at: -1 }).lean()
    ]);
    rows.push(publicParticipantRow(person, sessions, completed, latest));
  }
  res.json(rows);
}));

router.post("/dashboard/participants", asyncHandler(async (req, res) => {
  const now = new Date();
  const participantCode = req.body.participant_code?.trim()?.toUpperCase() || await generateParticipantCode("P");
  const document = {
    email: normalizeEmail(req.body.email),
    name: String(req.body.name || "").trim(),
    participant_code: participantCode,
    password_hash: await hashPassword(req.body.password || generateToken(12)),
    role: "participant",
    is_active: req.body.is_active !== false,
    consent_completed: Boolean(req.body.consent_completed),
    profile_completed: Boolean(req.body.profile_completed),
    email_verified: true,
    approval_status: "approved",
    created_at: now,
    updated_at: now
  };
  document.profile = profileFromManualPayload(req.body, undefined);
  const participant = await Participant.create(document);
  await Participant.updateOne({ _id: participant._id }, { $set: { "profile.participant_id": participant._id } });
  const saved = await Participant.findById(participant._id).lean();
  res.status(201).json(publicParticipantRow(saved));
}));

router.put("/dashboard/participants/:participantId", asyncHandler(async (req, res) => {
  const participant = await resolveParticipant(req.params.participantId);
  const now = new Date();
  const updates = {
    email: normalizeEmail(req.body.email),
    name: String(req.body.name || "").trim(),
    participant_code: req.body.participant_code?.trim()?.toUpperCase() || participant.participant_code,
    is_active: req.body.is_active !== false,
    consent_completed: Boolean(req.body.consent_completed),
    profile_completed: Boolean(req.body.profile_completed),
    profile: profileFromManualPayload(req.body, participant._id),
    updated_at: now
  };
  if (req.body.password) updates.password_hash = await hashPassword(req.body.password);
  await Participant.updateOne({ _id: participant._id }, { $set: updates });
  const saved = await Participant.findById(participant._id).lean();
  res.json(publicParticipantRow(saved));
}));

router.get("/dashboard/participants/:participantId", asyncHandler(async (req, res) => {
  const participant = await resolveParticipant(req.params.participantId);
  const [sessions, completed, latest] = await Promise.all([
    ResearchSession.countDocuments({ participant_id: participant._id }),
    ResearchSession.countDocuments({ participant_id: participant._id, status: "completed" }),
    ResearchSession.findOne({ participant_id: participant._id }).sort({ started_at: -1 }).lean()
  ]);
  res.json({ participant: publicParticipantRow(participant, sessions, completed, latest), profile: participant.profile || null });
}));

router.get("/dashboard/sessions", asyncHandler(async (_req, res) => {
  const sessions = await ResearchSession.find({}).sort({ started_at: -1 }).lean();
  res.json(await Promise.all(sessions.map(publicSessionRow)));
}));

router.post("/dashboard/sessions", asyncHandler(async (req, res) => {
  const participant = await resolveParticipant(req.body.participant_id);
  const count = await ResearchSession.countDocuments({ participant_id: participant._id });
  const now = new Date();
  const statusValue = String(req.body.status || "incomplete").replace("-", "_").replace("pending_review", "pending");
  const session = await ResearchSession.create({
    participant_id: participant._id,
    session_code: (req.body.session_code || `S${String(count + 1).padStart(2, "0")}`).trim().toUpperCase(),
    condition: req.body.condition,
    task: req.body.task,
    status: statusValue,
    started_at: req.body.started_at ? new Date(req.body.started_at) : now,
    completed_at: req.body.completed_at ? new Date(req.body.completed_at) : null,
    duration_seconds: req.body.duration_seconds ?? null,
    signal_quality: req.body.signal_quality || "pending",
    created_at: now,
    updated_at: now
  });
  await syncManualSessionChildren(session, req.body);
  await createNotification("research_session_created", "New research session created", `${session.session_code} was created for ${participant.participant_code || "participant"}.`, session._id);
  const saved = await ResearchSession.findById(session._id).lean();
  res.status(201).json(await publicSessionRow(saved));
}));

router.put("/dashboard/sessions/:sessionId", asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const existing = await ResearchSession.findById(req.params.sessionId).lean();
  if (!existing) throw makeError(404, "Session not found");
  const participant = await resolveParticipant(req.body.participant_id);
  const now = new Date();
  const statusValue = String(req.body.status || "incomplete").replace("-", "_").replace("pending_review", "pending");
  await ResearchSession.updateOne({ _id: existing._id }, {
    $set: {
      participant_id: participant._id,
      session_code: (req.body.session_code || existing.session_code || String(existing._id)).trim().toUpperCase(),
      condition: req.body.condition,
      task: req.body.task,
      status: statusValue,
      started_at: req.body.started_at ? new Date(req.body.started_at) : existing.started_at || now,
      completed_at: req.body.completed_at ? new Date(req.body.completed_at) : null,
      duration_seconds: req.body.duration_seconds ?? null,
      signal_quality: req.body.signal_quality || "pending",
      updated_at: now
    }
  });
  const saved = await ResearchSession.findById(existing._id).lean();
  await syncManualSessionChildren(saved, req.body);
  res.json(await publicSessionRow(await ResearchSession.findById(existing._id).lean()));
}));

router.get("/dashboard/sessions/:sessionId", asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findById(req.params.sessionId).lean();
  if (!session) throw makeError(404, "Session not found");
  const [participant, physiological, questionnaire, doctorAssessment] = await Promise.all([
    Participant.findById(session.participant_id).lean(),
    Physiological.findOne({ session_id: session._id }).lean(),
    QuestionnaireResponse.findOne({ session_id: session._id }).lean(),
    DoctorAssessment.findOne({ session_id: session._id }).lean()
  ]);
  res.json({
    session: cleanDocument(session),
    participant: {
      id: String(participant?._id || ""),
      participant_code: participant?.participant_code || "Unknown",
      name: participant?.name || "Unknown participant"
    },
    physiological: cleanDocument(physiological || session.physiological),
    questionnaire: cleanDocument(questionnaire || session.questionnaire),
    doctor_assessment: cleanDocument(doctorAssessment || session.doctor_assessment)
  });
}));

router.get("/dashboard/thingspeak/latest", asyncHandler(async (_req, res) => {
  const latest = await fetchLatestThingSpeakReading();
  res.json(publicPhysiological(latest));
}));

router.post("/dashboard/sessions/:sessionId/thingspeak-sync", asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.sessionId)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findById(req.params.sessionId).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const series = await fetchThingSpeakReadings({ minutes: req.body.duration_minutes ?? 5 });
  const latest = series[series.length - 1] || await fetchLatestThingSpeakReading();
  const physiological = {
    ...latest,
    series,
    condition: session.condition,
    recorded_at: latest.recorded_at ? new Date(latest.recorded_at) : now,
    updated_at: now
  };
  await ResearchSession.updateOne({ _id: session._id }, {
    $set: {
      physiological,
      signal_quality: physiological.signal_quality || "good",
      updated_at: now
    }
  });
  await upsertPhysiologicalRecord(session, physiological);
  await createNotification("thingspeak_data_synced", "ThingSpeak sensor data synced", `Latest ThingSpeak reading saved for ${session.session_code || req.params.sessionId}.`, session._id);
  res.status(201).json(await publicSessionRow(await ResearchSession.findById(session._id).lean()));
}));

router.get("/dashboard/exports/:filename", asyncHandler(async (req, res) => {
  if (!EXPORTS[req.params.filename]) throw makeError(404, "Unknown export dataset");
  const content = await exportCsv(req.params.filename, req.query.condition);
  await createNotification("export_completed", "Export completed", `${req.params.filename} was generated successfully.`);
  res.header("content-type", "text/csv; charset=utf-8");
  res.header("content-disposition", `attachment; filename="${req.params.filename}"`);
  res.send(content);
}));

router.get("/dashboard/physiological", asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.quality) query.signal_quality = req.query.quality;
  if (req.query.condition) query.condition = req.query.condition;
  const records = await Physiological.find(query).sort({ recorded_at: -1 }).lean();
  const people = await Participant.find({ _id: { $in: records.map((item) => item.participant_id).filter(Boolean) } }).lean();
  const map = new Map(people.map((item) => [String(item._id), item]));
  const search = String(req.query.search || "").toLowerCase().trim();
  const rows = [];
  for (const item of records) {
    const person = map.get(String(item.participant_id)) || {};
    const condition = item.condition || "relaxed";
    if (search && !`${item.participant_code || person.participant_code || ""} ${item.session_code || ""}`.toLowerCase().includes(search)) continue;
    rows.push({
      id: String(item._id),
      participant_id: item.participant_code || person.participant_code || String(item.participant_id || ""),
      session_id: item.session_code || String(item.session_id || ""),
      condition,
      ecg_collected: Boolean(item.ecg),
      heart_rate: item.heart_rate,
      hrv: item.hrv,
      eda: item.eda,
      temperature: item.temperature,
      respiration: item.respiration,
      mean_temp: item.mean_temp ?? item.temperature,
      rmssd_ms: item.rmssd_ms ?? item.hrv,
      sdnn_ms: item.sdnn_ms,
      heart_rate_bpm: item.heart_rate_bpm ?? item.heart_rate,
      spo2_percent: item.spo2_percent,
      scl_us: item.scl_us ?? item.eda,
      scr_peak_count: item.scr_peak_count,
      scr_mean: item.scr_mean,
      sensor_fields: item.sensor_fields || [],
      thingspeak: item.thingspeak || null,
      accelerometer: Boolean(item.accelerometer || item.acc),
      battery: item.battery,
      sampling_rate: item.sampling_rate,
      signal_quality: item.signal_quality || null,
      recorded_at: item.recorded_at
    });
  }
  res.json(rows);
}));

router.get("/dashboard/questionnaires", asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.condition) query.condition = req.query.condition;
  const responses = await QuestionnaireResponse.find(query).sort({ submitted_at: -1 }).lean();
  const people = await Participant.find({ _id: { $in: responses.map((item) => item.participant_id).filter(Boolean) } }).lean();
  const map = new Map(people.map((item) => [String(item._id), item]));
  const rows = responses.filter(hasFilledQuestionnaireAnswers).map((item) => {
    const answers = item.answers || {};
    const person = map.get(String(item.participant_id)) || {};
    return {
      id: String(item._id),
      participant_id: item.participant_code || person.participant_code || String(item.participant_id || ""),
      session_id: item.session_code || String(item.session_id || ""),
      condition: item.condition || "relaxed",
      questionnaire_key: item.questionnaire_key,
      answers,
      mood: answers.mood || answers.current_mood,
      stress: answers.stress || answers.current_stress,
      sleep: answers.sleep,
      fatigue: answers.fatigue,
      physical: answers.physical,
      lifestyle: answers.lifestyle,
      score: item.score,
      timestamp: item.submitted_at || item.created_at,
      completed: item.score !== undefined && item.score !== null
    };
  });
  res.json(rows);
}));

router.get("/dashboard/doctor", asyncHandler(async (req, res) => {
  const sessions = await ResearchSession.find({}).sort({ started_at: -1 }).lean();
  const [people, assessments] = await Promise.all([
    Participant.find({ _id: { $in: sessions.map((item) => item.participant_id).filter(Boolean) } }).lean(),
    DoctorAssessment.find({}).lean()
  ]);
  const map = new Map(people.map((item) => [String(item._id), item]));
  const assessmentsBySession = new Map(assessments.filter((item) => item.session_id).map((item) => [String(item.session_id), item]));
  const status = req.query.status;
  const rows = [];
  for (const session of sessions) {
    const assessment = assessmentsBySession.get(String(session._id)) || session.doctor_assessment;
    const itemStatus = assessment ? "completed" : "pending";
    if (status && itemStatus !== status) continue;
    const person = map.get(String(session.participant_id)) || {};
    rows.push({
      id: String(session._id),
      session_record_id: String(session._id),
      participant_id: person.participant_code || String(session.participant_id || ""),
      session_id: session.session_code || String(session._id),
      condition: session.condition || "relaxed",
      clinical_stress_label: assessment?.clinical_stress,
      comments: assessment?.comments,
      recommendation: assessment?.recommendation,
      status: itemStatus
    });
  }
  res.json(rows);
}));

router.post("/dashboard/doctor", asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.body.session_id)) throw makeError(400, "Invalid session ID");
  const session = await ResearchSession.findById(req.body.session_id).lean();
  if (!session) throw makeError(404, "Session not found");
  const now = new Date();
  const document = {
    clinical_stress: req.body.clinical_stress_label,
    comments: req.body.comments,
    recommendation: req.body.recommendation,
    created_at: now,
    updated_at: now
  };
  await ResearchSession.updateOne({ _id: session._id }, { $set: { doctor_assessment: document, updated_at: now } });
  await upsertDoctorAssessment(session, document);
  await createNotification("doctor_assessment_completed", "Doctor assessment completed", `Clinical label saved for ${session.session_code || req.body.session_id}.`, session._id);
  const participant = await Participant.findById(session.participant_id).lean();
  res.status(201).json({
    id: String(session._id),
    participant_id: participant?.participant_code || String(session.participant_id || ""),
    session_id: session.session_code || req.body.session_id,
    condition: session.condition || "relaxed",
    clinical_stress_label: document.clinical_stress,
    comments: document.comments,
    recommendation: document.recommendation,
    status: "completed"
  });
}));

router.get("/dashboard/notifications", asyncHandler(async (_req, res) => {
  const notifications = await Notification.find({}).sort({ created_at: -1 }).limit(50).lean();
  res.json(notifications.map((item) => ({
    id: String(item._id),
    type: item.type || "info",
    title: item.title || "Notification",
    message: item.message || "",
    related_id: item.related_id ? String(item.related_id) : null,
    created_at: item.created_at,
    read: Boolean(item.read)
  })));
}));

router.post("/dashboard/notifications/:notificationId/read", asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.notificationId)) throw makeError(400, "Invalid notification ID");
  const result = await Notification.updateOne({ _id: req.params.notificationId }, { $set: { read: true, read_at: new Date() } });
  if (!result.matchedCount) throw makeError(404, "Notification not found");
  res.json({ status: "updated" });
}));

router.get("/dashboard/access-requests", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const requests = await DashboardAccessRequest.find({}).sort({ requested_at: -1 }).lean();
  res.json(requests.map((item) => ({
    id: String(item._id),
    requestCode: item.request_code,
    name: item.name || "",
    email: item.email || "",
    organization: item.organization || "",
    requestedRole: item.requested_role || "viewer",
    reason: item.reason || "",
    status: item.status || "pending",
    emailVerified: Boolean(item.email_verified),
    createdAt: item.requested_at || item.created_at || null,
    reviewedAt: item.reviewed_at || null,
    reviewNote: item.review_note
  })));
}));

router.patch("/dashboard/access-requests/:requestId", requireSuperAdmin, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.requestId)) throw makeError(404, "Access request not found");
  const request = await DashboardAccessRequest.findById(req.params.requestId).lean();
  if (!request) throw makeError(404, "Access request not found");
  const now = new Date();
  if (req.body.status === "approved") {
    const email = normalizeEmail(request.email);
    let participant = await Participant.findOne({ email }).lean();
    const accountUpdates = {
      email,
      name: request.name || "Dashboard user",
      role: request.requested_role || "viewer",
      is_active: true,
      approval_status: "approved",
      approved_at: now,
      email_verified: true,
      email_verified_at: now,
      consent_completed: true,
      profile_completed: true,
      updated_at: now
    };
    if (participant) {
      await Participant.updateOne({ _id: participant._id }, { $set: accountUpdates });
    } else {
      participant = await Participant.create({
        ...accountUpdates,
        participant_code: await generateParticipantCode("R"),
        password_hash: await hashPassword(generateToken(18)),
        created_at: now
      });
    }
    const setupToken = generateToken();
    await PasswordResetToken.create({
      participant_id: participant._id,
      token_hash: hashSecret(setupToken),
      used: false,
      created_at: now,
      expires_at: new Date(now.getTime() + 30 * 60 * 1000)
    });
    await sendPasswordResetEmail({ ...participant, ...accountUpdates }, setupToken);
  }
  await DashboardAccessRequest.updateOne({ _id: request._id }, {
    $set: {
      status: req.body.status,
      reviewed_by: req.participant._id,
      review_note: req.body.review_note,
      reviewed_at: now,
      updated_at: now
    }
  });
  res.json({ id: req.params.requestId, status: req.body.status, message: req.body.status === "approved" ? "Access request approved" : "Access request declined" });
}));

router.delete("/dashboard/access-requests/:requestId", requireSuperAdmin, asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.requestId)) throw makeError(404, "Access request not found");
  const result = await DashboardAccessRequest.deleteOne({ _id: req.params.requestId });
  if (!result.deletedCount) throw makeError(404, "Access request not found");
  res.status(204).send();
}));

export default router;
