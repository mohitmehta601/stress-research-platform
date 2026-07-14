import crypto from "crypto";
import bcrypt from "bcryptjs";

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(password, encoded) {
  if (!encoded) return false;
  if (!encoded.startsWith("$2")) return false;
  return bcrypt.compare(String(password), encoded);
}

export function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      const error = new Error(`${field} is required`);
      error.status = 400;
      throw error;
    }
  }
}
