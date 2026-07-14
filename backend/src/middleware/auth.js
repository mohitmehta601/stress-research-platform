import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { settings } from "../config/settings.js";
import { DASHBOARD_ROLES, SUPER_ADMIN_ROLE } from "../config/roles.js";
import { Participant } from "../models/index.js";

export function createAccessToken(participantId) {
  return jwt.sign({ sub: String(participantId), typ: "access" }, settings.jwtSecret, {
    algorithm: settings.jwtAlgorithm,
    expiresIn: `${settings.accessTokenMinutes}m`
  });
}

export function createRefreshToken(participantId) {
  return jwt.sign({ sub: String(participantId), typ: "refresh" }, settings.jwtSecret, {
    algorithm: settings.jwtAlgorithm,
    expiresIn: `${settings.refreshTokenDays}d`
  });
}

function readBearer(req) {
  const header = req.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

async function participantFromToken(token, expectedType = "access") {
  try {
    const payload = jwt.verify(token, settings.jwtSecret, { algorithms: [settings.jwtAlgorithm] });
    if (payload.typ !== expectedType || !Types.ObjectId.isValid(payload.sub)) return null;
    return Participant.findById(payload.sub).lean();
  } catch {
    return null;
  }
}

export async function getParticipantFromRefreshToken(token) {
  const participant = await participantFromToken(token, "refresh");
  if (!participant || participant.is_active === false) return null;
  return participant;
}

export async function requireParticipant(req, res, next) {
  const token = readBearer(req) || req.cookies?.srp_access_token;
  const participant = token ? await participantFromToken(token, "access") : null;
  if (!participant || participant.is_active === false) {
    return res.status(401).json({ detail: "Invalid or expired access token" });
  }
  req.participant = participant;
  next();
}

export function requireResearcher(req, res, next) {
  const role = req.participant?.role || "participant";
  if (!DASHBOARD_ROLES.has(role)) {
    return res.status(403).json({ detail: "Dashboard access is required" });
  }
  if (role !== SUPER_ADMIN_ROLE && (req.participant?.approval_status || "approved") !== "approved") {
    return res.status(403).json({ detail: "Your dashboard access request has not been approved" });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.participant?.role !== SUPER_ADMIN_ROLE) {
    return res.status(403).json({ detail: "Super administrator access is required" });
  }
  next();
}

export function setAuthCookie(res, payload) {
  res.cookie("srp_access_token", payload.access_token, {
    maxAge: settings.accessTokenMinutes * 60 * 1000,
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/"
  });
}
