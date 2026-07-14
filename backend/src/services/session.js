import { createRefreshToken } from "../middleware/auth.js";

export function rotateRefreshToken(participantId) {
  return createRefreshToken(participantId);
}
