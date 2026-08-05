import { Capacitor, registerPlugin } from "@capacitor/core"

export type SessionType = "relaxed" | "stress"

export type SavedAudio = {
  fileName: string
  location: string
  uri: string
}

type AudioStoragePlugin = {
  checkPermissions: () => Promise<{ publicStorage?: PermissionState }>
  requestPermissions: (options?: { permissions?: string[] }) => Promise<{ publicStorage?: PermissionState }>
  saveAudio: (options: {
    base64Data: string
    fileName: string
    mimeType: string
    sessionType: SessionType
  }) => Promise<SavedAudio>
  openAppSettings: () => Promise<void>
}

type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied"

export class AudioStorageError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "AudioStorageError"
    this.code = code
  }
}

const AudioStorage = registerPlugin<AudioStoragePlugin>("AudioStorage")

const MIME_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
}

const sessionLabels: Record<SessionType, "Relaxed" | "Stress"> = {
  relaxed: "Relaxed",
  stress: "Stress",
}

export function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\.+$/g, "")
    .replace(/_+/g, "_")
}

export function getAudioExtension(mimeType: string): string {
  const cleanMime = mimeType.split(";")[0].toLowerCase()
  return MIME_EXTENSION[cleanMime] || cleanMime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "webm"
}

export function buildAudioFilename(options: {
  pid: string
  personName: string
  sessionType: SessionType
  mimeType: string
  recordedAt?: Date
}): string {
  const pid = sanitizeFilenamePart(options.pid)
  const personName = sanitizeFilenamePart(options.personName)

  if (!pid) throw new AudioStorageError("missing_pid", "Participant PID is missing. Please sign in again before saving audio.")
  if (!personName) throw new AudioStorageError("missing_name", "Participant name is missing. Please complete your profile before saving audio.")
  if (!sessionLabels[options.sessionType]) throw new AudioStorageError("unsupported_session", "Unsupported session type. Choose Relaxed or Stress and try again.")

  const date = options.recordedAt ?? new Date()
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "_",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("")

  return `${pid}_${personName}_${sessionLabels[options.sessionType]}_${timestamp}.${getAudioExtension(options.mimeType)}`
}

export async function ensureAudioStoragePermission(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return

  const current = await AudioStorage.checkPermissions()
  if (current.publicStorage === "granted" || current.publicStorage === undefined) return

  if (current.publicStorage === "denied") {
    throw new AudioStorageError("permission_permanently_denied", "Storage permission is permanently denied. Open app settings and allow storage access.")
  }

  const requested = await AudioStorage.requestPermissions({ permissions: ["publicStorage"] })
  if (requested.publicStorage === "granted" || requested.publicStorage === undefined) return

  if (requested.publicStorage === "denied") {
    throw new AudioStorageError("permission_permanently_denied", "Storage permission is permanently denied. Open app settings and allow storage access.")
  }

  throw new AudioStorageError("permission_denied", "Storage permission was denied. Allow storage access to save audio on this phone.")
}

export async function saveRecordingToPhone(options: {
  blob: Blob
  pid: string
  personName: string
  sessionType: SessionType
}): Promise<SavedAudio> {
  if (Capacitor.getPlatform() !== "android") {
    throw new AudioStorageError("unsupported_platform", "Permanent phone storage is available in the Android app.")
  }

  await ensureAudioStoragePermission()

  const mimeType = options.blob.type || "audio/webm"
  const fileName = buildAudioFilename({
    pid: options.pid,
    personName: options.personName,
    sessionType: options.sessionType,
    mimeType,
  })
  const base64Data = await blobToBase64(options.blob)

  try {
    return await AudioStorage.saveAudio({
      base64Data,
      fileName,
      mimeType,
      sessionType: options.sessionType,
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Audio could not be saved to phone storage."
    throw new AudioStorageError("save_failed", message)
  }
}

export async function openAudioStorageSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return
  await AudioStorage.openAppSettings()
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new AudioStorageError("read_failed", "Could not read the completed recording. Please record again."))
    reader.onload = () => {
      const result = String(reader.result || "")
      resolve(result.includes(",") ? result.split(",")[1] : result)
    }
    reader.readAsDataURL(blob)
  })
}
