import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Menu, Check, X, ChevronRight, ChevronDown,
  Home, Clock, BarChart2, User, Users, Search, Download, Save,
  Activity, Heart, Thermometer, Battery, Mic,
  Brain, Shield, FileText, Zap, Database, Info,
  Square, Pause, Play, RotateCcw,
  LogOut, TrendingUp, CheckCircle, AlertCircle, Stethoscope,
  Eye, EyeOff, Filter, Radio,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { api, type MobileParticipant, type MobileSession } from "../services/apiClient"

// â”€â”€â”€ Design constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NAVY = "#0B1E3D"
const BLUE = "#1D68F0"
const GREEN = "#16A34A"
const RED = "#DC2626"
const ORANGE = "#EA580C"
const TEAL = "#0D9488"

const currentTime = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
const parseBackendDate = (value: string) => new Date(/\dT\d/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value)
const formatBackendDateTime = (value: string) => parseBackendDate(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Screen =
  | "splash" | "register" | "login"
  | "consent" | "participant-profile" | "select-session"
  | "relaxed-instructions" | "relaxed-recording"
  | "stress-task-select" | "stress-task" | "stress-recording"
  | "audio-recording" | "questionnaire" | "questionnaire-complete"
  | "session-summary" | "history" | "participant-dashboard"
  | "profile-view" | "staff-login"
  | "researcher-dashboard" | "researcher-participants" | "researcher-sessions"
  | "sensor-quality" | "doctor-assessment" | "export" | "export-history"
  | "data-overview"

type SessionType = "relaxed" | "stress"
type Nav = (s: Screen, opts?: { sessionType?: SessionType; task?: number }) => void

const QUESTIONS = [
  { id: "A1", cat: "A. Emotional Stress", q: "I felt emotionally overwhelmed by my daily responsibilities." },
  { id: "A2", cat: "A. Emotional Stress", q: "I found it difficult to remain calm during stressful situations." },
  { id: "A3", cat: "A. Emotional Stress", q: "I became irritated over minor issues." },
  { id: "A4", cat: "A. Emotional Stress", q: "I worried excessively about future events." },
  { id: "A5", cat: "A. Emotional Stress", q: "I found it difficult to relax even during free time." },
  { id: "A6", cat: "A. Emotional Stress", q: "I felt mentally exhausted at the end of the day." },
  { id: "B1", cat: "B. Cognitive Stress", q: "I had difficulty concentrating on important tasks." },
  { id: "B2", cat: "B. Cognitive Stress", q: "I forgot things more often than usual." },
  { id: "B3", cat: "B. Cognitive Stress", q: "I found it difficult to make decisions." },
  { id: "B4", cat: "B. Cognitive Stress", q: "My thoughts kept racing even when I wanted to rest." },
  { id: "B5", cat: "B. Cognitive Stress", q: "I felt mentally overloaded." },
  { id: "C1", cat: "C. Physical Stress", q: "My heartbeat felt faster than usual without physical activity." },
  { id: "C2", cat: "C. Physical Stress", q: "I experienced muscle tension or stiffness." },
  { id: "C3", cat: "C. Physical Stress", q: "I felt unusually tired despite adequate rest." },
  { id: "C4", cat: "C. Physical Stress", q: "I experienced headaches or body discomfort due to stress." },
  { id: "C5", cat: "C. Physical Stress", q: "I noticed changes in my breathing during stressful moments." },
  { id: "D1", cat: "D. Sleep and Recovery", q: "I had difficulty falling asleep." },
  { id: "D2", cat: "D. Sleep and Recovery", q: "I woke up during the night." },
  { id: "D3", cat: "D. Sleep and Recovery", q: "I felt refreshed after waking up.", reverse: true },
  { id: "D4", cat: "D. Sleep and Recovery", q: "Poor sleep affected my performance during the day." },
  { id: "E1", cat: "E. Behavioural Changes", q: "I avoided activities because I felt stressed." },
  { id: "E2", cat: "E. Behavioural Changes", q: "I lost interest in things I usually enjoy." },
  { id: "E3", cat: "E. Behavioural Changes", q: "I became impatient while interacting with others." },
  { id: "E4", cat: "E. Behavioural Changes", q: "I found myself using my phone or social media more than usual to cope with stress." },
  { id: "E5", cat: "E. Behavioural Changes", q: "I found it difficult to manage my daily schedule." },
  { id: "F1", cat: "F. Positive Coping", q: "I was confident that I could manage stressful situations.", reverse: true },
  { id: "F2", cat: "F. Positive Coping", q: "I maintained a positive attitude despite difficulties.", reverse: true },
  { id: "F3", cat: "F. Positive Coping", q: "I successfully controlled my emotions during challenging situations.", reverse: true },
  { id: "F4", cat: "F. Positive Coping", q: "I felt capable of handling unexpected problems.", reverse: true },
  { id: "G1", cat: "G. Lifestyle and Environment", q: "My workload was heavier than I could comfortably manage." },
  { id: "G2", cat: "G. Lifestyle and Environment", q: "I had enough time to relax during the day.", reverse: true },
  { id: "G3", cat: "G. Lifestyle and Environment", q: "My surroundings made me feel stressed." },
  { id: "G4", cat: "G. Lifestyle and Environment", q: "I felt socially supported by family or friends.", reverse: true },
  { id: "H1", cat: "H. Technology and Digital Behaviour", q: "Frequent notifications interrupted my concentration." },
  { id: "H2", cat: "H. Technology and Digital Behaviour", q: "I spent more time on digital devices when feeling stressed." },
  { id: "H3", cat: "H. Technology and Digital Behaviour", q: "I checked my phone immediately after waking up." },
  { id: "H4", cat: "H. Technology and Digital Behaviour", q: "Digital distractions affected my productivity." },
  { id: "H5", cat: "H. Technology and Digital Behaviour", q: "I took regular breaks from digital devices.", reverse: true },
  { id: "H6", cat: "H. Technology and Digital Behaviour", q: "My digital habits affected my stress level." },
]
const STRESS_TASKS = [
  {
    title: "Mental Arithmetic",
    desc: "Subtract numbers under time pressure.",
    badge: "MA",
    instruction: "Subtract 17 from 1000 and continue subtracting 17 from each result as fast as possible.",
    button: "Next (-17)",
  },
  {
    title: "Stroop Test",
    desc: "Select ink color while ignoring word meaning.",
    badge: "ST",
    instruction: "Look at the displayed word and respond according to the ink color, not the word meaning.",
    button: "Next color item",
  },
  {
    title: "Memory Test",
    desc: "Remember and repeat long number sequences.",
    badge: "MEM",
    instruction: "Memorize the number sequence shown below. Continue to the next sequence when ready.",
    button: "Next sequence",
  },
  {
    title: "Time Pressure Task",
    desc: "Solve problems before the countdown expires.",
    badge: "TIME",
    instruction: "Solve each quick problem before the countdown ends. Move as fast as possible.",
    button: "Next problem",
  },
]
const AUDIO_PROMPT = "The quick brown fox jumps over the lazy dog. This sentence contains every letter in the English alphabet."

// â”€â”€â”€ Sparkline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Sparkline({ type = "heart", color = BLUE }: { type?: string; color?: string }) {
  const waves: Record<string, string> = {
    ecg:   "0,50 4,50 7,48 9,8 11,88 13,5 15,78 17,50 22,50 26,50 28,48 30,8 32,88 34,5 36,78 38,50 43,50 47,50 49,48 51,8 53,88 55,5 57,78 59,50 64,50 68,50 70,48 72,8 74,88 76,5 78,78 80,50 85,50 89,50 91,48 93,8 95,88 97,5 99,78 100,50",
    heart: "0,50 10,38 20,62 30,28 40,72 50,44 60,56 70,35 80,65 90,42 100,50",
    hrv:   "0,50 8,33 16,67 24,28 32,72 40,38 48,62 56,30 64,70 72,40 80,60 88,35 96,65 100,50",
    eda:   "0,72 12,64 24,54 36,42 48,33 60,28 68,26 76,30 84,36 92,42 100,40",
    temp:  "0,50 20,52 40,49 60,53 80,50 100,51",
    resp:  "0,50 8,32 17,50 25,68 33,50 42,32 50,50 58,68 67,50 75,32 83,50 92,68 100,50",
    accel: "0,50 5,38 10,62 15,44 20,56 25,36 30,66 35,44 40,56 45,40 50,60 55,44 60,56 65,38 70,64 75,44 80,56 85,40 90,60 95,46 100,52",
  }
  return (
    <svg viewBox="0 0 100 100" className="w-full h-9" preserveAspectRatio="none">
      <polyline points={waves[type] ?? waves.heart} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// â”€â”€â”€ Shared components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NavBar({ title, subtitle, onBack, right, dark = false }: {
  title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; dark?: boolean
}) {
  return (
    <div style={{ backgroundColor: dark ? NAVY : NAVY }} className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
      {onBack
        ? <button onClick={onBack} className="text-white/90 hover:text-white p-0.5 -ml-0.5 flex-shrink-0"><ArrowLeft size={20} /></button>
        : <div className="w-5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-[15px] leading-snug truncate">{title}</p>
        {subtitle && <p className="text-blue-200 text-xs leading-snug">{subtitle}</p>}
      </div>
      {right ?? <div className="w-5" />}
    </div>
  )
}

function BottomTabs({ active, nav }: { active: Screen; nav: Nav }) {
  const tabs = [
    { id: "select-session" as Screen,         Icon: Home,     label: "Home"      },
    { id: "history" as Screen,                Icon: Clock,    label: "History"   },
    { id: "participant-dashboard" as Screen,  Icon: BarChart2,label: "Dashboard" },
    { id: "profile-view" as Screen,           Icon: User,     label: "Profile"   },
  ]
  return (
    <div className="flex border-t border-gray-100 bg-white flex-shrink-0">
      {tabs.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => nav(id)} className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5">
          <Icon size={20} style={{ color: active === id ? BLUE : "#9CA3AF" }} />
          <span className="text-[10px] font-semibold" style={{ color: active === id ? BLUE : "#9CA3AF" }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function ResearcherTabs({ active, nav }: { active: Screen; nav: Nav }) {
  const tabs = [
    { id: "researcher-dashboard" as Screen,     Icon: BarChart2, label: "Dashboard"    },
    { id: "researcher-participants" as Screen,  Icon: Users,     label: "Participants" },
    { id: "researcher-sessions" as Screen,      Icon: Activity,  label: "Sessions"     },
    { id: "export" as Screen,                   Icon: Download,  label: "Export"       },
  ]
  return (
    <div className="flex border-t border-gray-100 bg-white flex-shrink-0">
      {tabs.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => nav(id)} className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5">
          <Icon size={20} style={{ color: active === id ? BLUE : "#9CA3AF" }} />
          <span className="text-[10px] font-semibold" style={{ color: active === id ? BLUE : "#9CA3AF" }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    Good:      ["#DCFCE7", "#15803D"], Moderate: ["#FEF9C3", "#A16207"],
    Poor:      ["#FEE2E2", "#B91C1C"], Missing:  ["#F1F5F9", "#64748B"],
    Pending:   ["#FFF7ED", "#C2410C"], Completed:["#DCFCE7", "#15803D"],
    Collected: ["#DBEAFE", "#1D4ED8"], Accepted: ["#DCFCE7", "#15803D"],
    Rejected:  ["#FEE2E2", "#B91C1C"], Active:   ["#DBEAFE", "#1D4ED8"],
  }
  const [bg, text] = map[status] ?? ["#F1F5F9", "#64748B"]
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color: text }}>{status}</span>
}

function Btn({ children, onClick, color, variant = "primary", sm = false }: {
  children: React.ReactNode; onClick?: () => void; color?: string; variant?: "primary"|"outline"|"ghost"; sm?: boolean
}) {
  const base = `${sm ? "py-2 text-sm" : "py-3.5 text-[15px]"} w-full rounded-xl font-semibold transition-opacity active:opacity-80`
  if (variant === "outline") return <button onClick={onClick} className={base + " border-2"} style={{ borderColor: color ?? BLUE, color: color ?? BLUE }}>{children}</button>
  if (variant === "ghost")   return <button onClick={onClick} className={`${sm ? "py-1.5 text-sm" : "py-2.5 text-sm"} w-full font-medium`} style={{ color: color ?? BLUE }}>{children}</button>
  return <button onClick={onClick} className={base + " text-white"} style={{ backgroundColor: color ?? BLUE }}>{children}</button>
}

function FieldInput({ label, type = "text", placeholder, icon: Icon, value, onChange }: {
  label: string; type?: string; placeholder?: string; icon?: React.ComponentType<{ size: number; className?: string }>; value?: string; onChange?: (v: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange?.(e.target.value)}
          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-blue-400 ${Icon ? "pl-9" : "pl-4"}`}
          style={{ focusRingColor: BLUE } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>{children}</div>
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/60 rounded-t-2xl">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-4 py-1">{children}</div>
    </Card>
  )
}

function FormRow({ label, value, placeholder, editable = true, onChange }: { label: string; value?: string; placeholder?: string; editable?: boolean; onChange?: (value: string) => void }) {
  const [v, setV] = useState(value ?? "")
  useEffect(() => setV(value ?? ""), [value])
  const update = (next: string) => {
    setV(next)
    onChange?.(next)
  }
  return (
    <div className="flex items-start py-3 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-sm text-gray-500 w-28 flex-shrink-0 leading-snug">{label}</span>
      {editable
        ? <input value={v} placeholder={placeholder} onChange={e => update(e.target.value)} className="min-w-0 flex-1 text-sm font-medium text-gray-800 placeholder-gray-300 bg-transparent focus:outline-none text-right leading-snug" />
        : <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 text-right leading-snug break-words" style={{ overflowWrap: "anywhere" }}>{v || "-"}</span>}
    </div>
  )
}
function SignalCard({ label, value, unit, sparkType, color }: { label: string; value: string; unit: string; sparkType: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <Sparkline type={sparkType} color={color} />
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-[15px] font-bold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        <span className="text-[11px] text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

function DataBit({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FFF7ED", color: "#C2410C" }}>Pend</span>
  if (ok)          return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>âœ“</span>
  return            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}>âœ—</span>
}

// â”€â”€â”€ Scroll wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScrollArea({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex-1 overflow-y-auto ${className}`} style={{ scrollbarWidth: "none" }}>
      {children}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SCREENS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// SCREEN 1 â€” Splash
function SplashScreen({ nav }: { nav: Nav }) {
  return (
    <div className="flex flex-col min-h-full" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #0D2B5C 55%, #071A36 100%)` }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-4">
        {/* Logo */}
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: "rgba(29,104,240,0.25)", border: "1.5px solid rgba(29,104,240,0.4)" }}>
          <Brain size={40} className="text-blue-300" />
        </div>
        <h1 className="text-white text-3xl font-bold tracking-tight mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>StressSense</h1>
        <p className="text-blue-200 text-xs text-center font-medium tracking-wide">Multimodal Stress Data Collection Platform</p>

        {/* Illustration */}
        <div className="relative mt-8 mb-6">
          <div className="w-52 h-52 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle, rgba(29,104,240,0.15) 0%, transparent 70%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-24 rounded-2xl bg-white/10 border border-white/20 flex items-end justify-center pb-2">
                <Activity size={20} className="text-blue-300" />
              </div>
              <div className="w-10 h-2 rounded-full bg-white/20" />
              <User size={28} className="text-blue-200 -mt-24 relative z-10" />
            </div>
          </div>
          {/* Sensor labels */}
          {[
            { label: "ECG",  top: "8%",  left: "-4%",  color: TEAL   },
            { label: "EDA",  top: "8%",  right: "-4%", color: BLUE   },
            { label: "HRV",  bottom: "12%", left: "-4%",  color: "#7C3AED" },
            { label: "Temp", bottom: "12%", right: "-4%", color: ORANGE },
          ].map(s => (
            <div key={s.label} className="absolute flex items-center justify-center" style={{ top: s.top, bottom: s.bottom, left: s.left, right: s.right }}>
              <span className="text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow" style={{ backgroundColor: `${s.color}CC` }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Sensor strip */}
        <div className="flex gap-2 flex-wrap justify-center mb-2">
          {["ECG", "HRV", "EDA", "Temp", "Questionnaire"].map(s => (
            <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="px-6 pb-10 flex flex-col gap-3">
        <Btn onClick={() => nav("register")} color={BLUE}>Create Participant Account</Btn>
        <Btn onClick={() => nav("login")} variant="outline" color="rgba(255,255,255,0.85)">
          <span className="text-white">Sign In</span>
        </Btn>
        <Btn onClick={() => nav("staff-login")} variant="outline" color="rgba(255,255,255,0.7)">
          <span className="text-white">{"I'm a Researcher / Doctor"}</span>
        </Btn>
      </div>
    </div>
  )
}

// SCREEN 2 â€” Register
function RegisterScreen({ nav }: { nav: Nav }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState("Participant")
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const submit = async () => {
    if (!agreed || busy) return
    setMessage("")
    if (!name.trim() || !email.trim()) { setError("Name and email are required"); return }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    setBusy(true)
    setError("")
    try {
      if (role !== "Participant") {
        nav("staff-login")
        return
      }
      const result = await api.register(name.trim(), email.trim().toLowerCase(), password)
      setOtpToken(result.otp_token)
      setOtpEmail(result.email)
      setOtpCode("")
      setMessage(result.message || "Verification code sent to your email.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setBusy(false)
    }
  }
  const verifyRegistration = async () => {
    if (busy) return
    setError("")
    setMessage("")
    if (otpCode.trim().length !== 6) { setError("Enter the 6-digit verification code"); return }
    setBusy(true)
    try {
      await api.verifyRegistrationOtp(otpToken, otpCode.trim())
      nav("consent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }
  const backToDetails = () => {
    setOtpToken("")
    setOtpCode("")
    setOtpEmail("")
    setMessage("")
    setPassword("")
    setConfirmPassword("")
  }
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Register" onBack={() => nav("splash")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        {/* Avatar */}
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-full bg-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
            <User size={28} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 mt-0.5">Upload Photo</span>
          </div>
        </div>
        <Card className="p-4 space-y-3">
          {otpToken ? (
            <>
              <div className="text-center py-2">
                <p className="text-base font-bold text-gray-900">Verify your email</p>
                <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to {otpEmail}.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Verification Code</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-center font-mono text-xl font-bold tracking-[0.35em] text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-blue-400"
                />
              </div>
              <button onClick={backToDetails} className="text-xs font-semibold text-gray-500">Edit sign-up details</button>
              <button onClick={submit} disabled={busy} className="text-xs font-semibold" style={{ color: BLUE }}>
                {busy ? "Sending..." : "Resend code"}
              </button>
            </>
          ) : (
            <>
              <FieldInput label="Full Name" placeholder="Full name" icon={User} value={name} onChange={setName} />
              <FieldInput label="Email Address" type="email" placeholder="anika@example.com" value={email} onChange={setEmail} />
              <FieldInput label="Phone Number" type="tel" placeholder="+91 98765 43210" />
              <FieldInput label="Password" type="password" placeholder="Enter password" value={password} onChange={setPassword} />
              <FieldInput label="Confirm Password" type="password" placeholder="Confirm password" value={confirmPassword} onChange={setConfirmPassword} />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Role</label>
                <div className="relative">
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-8 text-sm text-gray-800 focus:outline-none appearance-none">
                    {["Participant", "Researcher", "Doctor"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </Card>
        {!otpToken && (
          <div className="flex items-start gap-3 px-1">
            <button onClick={() => setAgreed(!agreed)} className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center ${agreed ? "border-blue-600" : "border-gray-300 bg-white"}`} style={{ backgroundColor: agreed ? BLUE : undefined }}>
              {agreed && <Check size={12} className="text-white" />}
            </button>
            <span className="text-sm text-gray-600">I agree to the <span className="font-semibold" style={{ color: BLUE }}>Terms & Privacy Policy</span></span>
          </div>
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">{error}</p>}
        {message && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2">{message}</p>}
        <Btn onClick={otpToken ? verifyRegistration : submit} color={(otpToken || agreed) && !busy ? BLUE : "#9CA3AF"}>{busy ? (otpToken ? "Verifying..." : "Creating account...") : (otpToken ? "Verify & Continue" : "Register")}</Btn>
        <p className="text-center text-sm text-gray-500 pb-4">Already have an account? <button onClick={() => nav("login")} className="font-semibold" style={{ color: BLUE }}>Login</button></p>
      </ScrollArea>
    </div>
  )
}

// SCREEN 3 â€” Login
function LoginScreen({ nav, onLogin }: { nav: Nav; onLogin: (role: "participant"|"researcher"|"doctor") => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [resetToken, setResetToken] = useState("")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("resetToken") || ""
    const resetEmail = params.get("email") || ""
    setResetToken(token)
    if (resetEmail) setEmail(resetEmail)
  }, [])

  const forgotPassword = async () => {
    if (busy) return
    setError("")
    setMessage("")
    if (!email.trim()) { setError("Enter your email address first"); return }
    setBusy(true)
    try {
      const result = await api.forgotPassword(email.trim().toLowerCase()) as { message?: string }
      setMessage(result.message || "If this email exists, reset instructions will be sent.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset email failed")
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (busy) return
    setError("")
    setMessage("")
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return }
    setBusy(true)
    try {
      const result = await api.resetPassword(resetToken, newPassword) as { message?: string }
      setMessage(result.message || "Password updated. You can now sign in.")
      setResetToken("")
      setPassword("")
      setNewPassword("")
      setConfirmPassword("")
      window.history.replaceState(null, "", window.location.pathname)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed")
    } finally {
      setBusy(false)
    }
  }

  const handleLogin = async () => {
    if (busy) return
    setError("")
    setMessage("")
    if (!email.trim() || !password) { setError("Email and password are required"); return }
    setBusy(true)
    try {
      const user = await api.login(email.trim().toLowerCase(), password)
      if (!user?.role) throw new Error("Login response was invalid. Please try again.")
      if (user.role === "super_admin") {
        throw new Error("Super admin access is only available on the web dashboard.")
      }
      if (user.role === "researcher" || user.role === "doctor") {
        onLogin(user.role === "doctor" ? "doctor" : "researcher"); nav("researcher-dashboard")
      } else {
        onLogin("participant")
        nav(user.next_step === "profile" ? "participant-profile" : user.next_step === "dashboard" ? "select-session" : "consent")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Login" onBack={() => nav("splash")} />
      <ScrollArea className="px-4 py-8">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow" style={{ backgroundColor: BLUE }}>
            <Brain size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Welcome back</h2>
          <p className="text-sm text-gray-500 mt-0.5">{resetToken ? "Set a new password" : "Sign in to continue"}</p>
        </div>
        <Card className="p-4 space-y-3 mb-4">
          {resetToken ? (
            <>
              <FieldInput label="New Password" type="password" placeholder="Minimum 8 characters" value={newPassword} onChange={setNewPassword} />
              <FieldInput label="Confirm Password" type="password" placeholder="Repeat new password" value={confirmPassword} onChange={setConfirmPassword} />
            </>
          ) : (
            <>
          <FieldInput label="Email Address" type="email" placeholder="your@email.com" value={email} onChange={setEmail} />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <button onClick={forgotPassword} className="text-xs font-semibold" style={{ color: BLUE }}>{busy ? "Sending..." : "Forgot password?"}</button>
          </div>
            </>
          )}
        </Card>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2 mb-3">{error}</p>}
        {message && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2 mb-3">{message}</p>}
        <Btn onClick={resetToken ? resetPassword : handleLogin} color={busy ? "#9CA3AF" : BLUE}>{busy ? (resetToken ? "Updating..." : "Signing in...") : (resetToken ? "Update Password" : "Login")}</Btn>
        <p className="text-center text-sm text-gray-500 mt-3">No account? <button onClick={() => nav("register")} className="font-semibold" style={{ color: BLUE }}>Create account</button></p>
      </ScrollArea>
    </div>
  )
}

// SCREEN 4 â€” Consent
function ConsentScreen({ nav }: { nav: Nav }) {
  const [read, setRead] = useState(false)
  const [busy, setBusy] = useState(false)
  const participant = api.currentParticipant
  const accept = async () => {
    if (!read || busy) return
    setBusy(true)
    try {
      await api.consent(true)
      const user = await api.me().catch(() => null)
      nav(user?.next_step === "dashboard" ? "select-session" : "participant-profile")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Research Consent" onBack={() => nav("login")} />
      <ScrollArea className="px-4 py-4 space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow mb-3" style={{ backgroundColor: "#EBF3FF" }}>
            <Shield size={32} style={{ color: BLUE }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Informed Consent</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>Participant ID: {participant?.participant_code ?? "Pending"}</span>
          </div>
        </div>
        <Card className="p-4 space-y-3">
          {[
            { icon: "01", title: "Study Purpose", text: "You are invited to participate in a research study to collect data related to stress using wearable sensors and questionnaires." },
            { icon: "02", title: "Data Confidentiality", text: "Your data will be used only for research purposes and will be kept strictly confidential. Data is stored securely and anonymised." },
            { icon: "03", title: "What We Collect", text: "Physiological signals (ECG, HR, HRV, GSR, EDA, Temperature) and questionnaire responses." },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 rounded-xl bg-gray-50">
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </Card>
        <div className="flex items-start gap-3 px-1">
          <button onClick={() => setRead(!read)} className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center`} style={{ borderColor: read ? BLUE : "#D1D5DB", backgroundColor: read ? BLUE : "white" }}>
            {read && <Check size={12} className="text-white" />}
          </button>
          <span className="text-sm text-gray-700 leading-relaxed">I have read and understood the information above and consent to participate.</span>
        </div>
        <Btn onClick={accept} color={read ? BLUE : "#9CA3AF"}>{busy ? "Saving..." : "I Agree"}</Btn>
        <Btn onClick={() => nav("splash")} variant="ghost" color={RED}>I Do Not Agree</Btn>
      </ScrollArea>
    </div>
  )
}

// SCREEN 6 â€” Participant Profile
function boolText(value: boolean) { return value ? "Yes" : "No" }
function yesNo(value: string) { return value.trim().toLowerCase().startsWith("y") }
function profileNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function requiredProfileNumber(label: string, value: string, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`)
  }
  return parsed
}

function bmiCategory(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return { label: "-", color: "#64748B" }
  if (value < 18.5) return { label: "Underweight", color: ORANGE }
  if (value < 25) return { label: "Normal", color: GREEN }
  if (value < 30) return { label: "Overweight", color: ORANGE }
  return { label: "Obese", color: RED }
}

// SCREEN 6 - Participant Profile
function ParticipantProfileScreen({ nav }: { nav: Nav }) {
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [education, setEducation] = useState("")
  const [occupation, setOccupation] = useState("")
  const [smoking, setSmoking] = useState<"" | "never" | "former" | "current">("")
  const [alcohol, setAlcohol] = useState<"" | "none" | "occasional" | "regular">("")
  const [sleepHours, setSleepHours] = useState("")
  const [exerciseDays, setExerciseDays] = useState("")
  const [heartDisease, setHeartDisease] = useState("")
  const [hypertension, setHypertension] = useState("")
  const [diabetes, setDiabetes] = useState("")
  const [medication, setMedication] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const bmi = (() => {
    const h = profileNumber(height)
    const w = profileNumber(weight)
    return h > 0 && w > 0 ? +(w / ((h / 100) ** 2)).toFixed(1) : 0
  })()
  const bmiStatus = bmiCategory(bmi)

  useEffect(() => {
    api.getProfile()
      .then(profile => {
        setAge(String(profile.age))
        setGender(profile.gender)
        setHeight(String(profile.height_cm))
        setWeight(String(profile.weight_kg))
        setEducation(profile.education)
        setOccupation(profile.occupation)
        setSmoking(profile.smoking)
        setAlcohol(profile.alcohol)
        setSleepHours(String(profile.sleep_hours))
        setExerciseDays(String(profile.exercise_days_per_week))
        setHeartDisease(boolText(profile.heart_disease))
        setHypertension(boolText(profile.hypertension))
        setDiabetes(boolText(profile.diabetes))
        setMedication(profile.medication || "")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setBusy(true)
    setError("")
    try {
      const profile = {
        age: Math.round(requiredProfileNumber("Age", age, 18, 100)),
        gender: gender.trim(),
        height_cm: requiredProfileNumber("Height", height, 51, 250),
        weight_kg: requiredProfileNumber("Weight", weight, 21, 350),
        education: education.trim(),
        occupation: occupation.trim(),
        smoking,
        alcohol,
        sleep_hours: requiredProfileNumber("Sleep hours", sleepHours, 0, 24),
        exercise_days_per_week: Math.round(requiredProfileNumber("Exercise days/week", exerciseDays, 0, 7)),
        heart_disease: yesNo(heartDisease),
        hypertension: yesNo(hypertension),
        diabetes: yesNo(diabetes),
        medication: medication.trim() ? medication.trim() : null,
      }
      if (!profile.gender || !profile.education || !profile.occupation || !profile.smoking || !profile.alcohol || !heartDisease.trim() || !hypertension.trim() || !diabetes.trim()) {
        throw new Error("Please complete all required profile fields before continuing")
      }
      await api.saveProfile(profile)
      await api.me().catch(() => null)
      nav("select-session")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Participant Profile" onBack={() => nav("consent")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        <SectionCard title="Personal Information">
          <FormRow label="Age" value={age} onChange={setAge} />
          <FormRow label="Gender" value={gender} onChange={setGender} />
          <FormRow label="Height (cm)" value={height} onChange={setHeight} />
          <FormRow label="Weight (kg)" value={weight} onChange={setWeight} />
          <div className="flex items-center py-2.5 border-b border-gray-50">
            <span className="text-sm text-gray-500 w-32 flex-shrink-0">BMI</span>
            <span className="flex-1 text-sm font-bold text-right" style={{ color: bmiStatus.color }}>{bmi || "-"} {bmi ? `- ${bmiStatus.label}` : ""}</span>
          </div>
        </SectionCard>
        <SectionCard title="Education & Occupation">
          <FormRow label="Education" value={education} onChange={setEducation} />
          <FormRow label="Occupation" value={occupation} onChange={setOccupation} />
        </SectionCard>
        <SectionCard title="Lifestyle">
          <div className="flex items-center py-2.5 border-b border-gray-50 gap-2">
            <span className="text-sm text-gray-500 w-32 flex-shrink-0">Smoking</span>
            <select value={smoking} onChange={e => setSmoking(e.target.value as typeof smoking)} className="flex-1 text-sm font-medium text-gray-800 bg-transparent focus:outline-none text-right">
              <option value="" disabled>Select</option>
              <option value="never">Never</option>
              <option value="former">Former</option>
              <option value="current">Current</option>
            </select>
          </div>
          <div className="flex items-center py-2.5 border-b border-gray-50 gap-2">
            <span className="text-sm text-gray-500 w-32 flex-shrink-0">Alcohol</span>
            <select value={alcohol} onChange={e => setAlcohol(e.target.value as typeof alcohol)} className="flex-1 text-sm font-medium text-gray-800 bg-transparent focus:outline-none text-right">
              <option value="" disabled>Select</option>
              <option value="none">None</option>
              <option value="occasional">Occasional</option>
              <option value="regular">Regular</option>
            </select>
          </div>
          <FormRow label="Sleep (hrs/day)" value={sleepHours} onChange={setSleepHours} />
          <FormRow label="Exercise days/wk" value={exerciseDays} onChange={setExerciseDays} />
        </SectionCard>
        <SectionCard title="Medical History">
          <FormRow label="Heart Disease" value={heartDisease} onChange={setHeartDisease} />
          <FormRow label="Hypertension" value={hypertension} onChange={setHypertension} />
          <FormRow label="Diabetes" value={diabetes} onChange={setDiabetes} />
          <FormRow label="Medication" value={medication} onChange={setMedication} />
        </SectionCard>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">{error}</p>}
        <Btn onClick={save} color={busy || loading ? "#9CA3AF" : BLUE}>{busy ? "Saving..." : "Save & Continue"}</Btn>
        <div className="h-4" />
      </ScrollArea>
    </div>
  )
}
// SCREEN 7 â€” Select Session (Home)
function SelectSessionScreen({ nav }: { nav: Nav }) {
  const [home, setHome] = useState<Awaited<ReturnType<typeof api.getParticipantHome>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [starting, setStarting] = useState<"relaxed" | "stress" | null>(null)

  const loadHome = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.getParticipantHome()
      setHome(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load participant data")
      setHome(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHome()
  }, [])

  const startSession = async (condition: "relaxed" | "stress") => {
    if (starting) return
    setStarting(condition)
    setError("")
    try {
      await api.createSession(condition)
      nav(condition === "relaxed" ? "relaxed-instructions" : "stress-task-select", { sessionType: condition })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create session")
      await loadHome().catch(() => {})
    } finally {
      setStarting(null)
    }
  }

  const participant = home?.participant ?? api.currentParticipant
  const sessions = home?.sessions ?? []
  const completedSessions = sessions.filter(s => s.q)
  const protocolRelaxedDone = completedSessions.some(s => s.cond === "Relaxed")
  const protocolStressDone = completedSessions.some(s => s.cond === "Stress")

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Select Session" right={<button onClick={loadHome} disabled={loading}><Menu size={20} className="text-white" /></button>} />
      <ScrollArea className="px-4 py-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Choose your session</h2>
          <p className="text-sm text-gray-500 mt-0.5">Select the type of session you want to start.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">Backend connection needed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={loadHome} className="text-xs font-bold mt-2" style={{ color: RED }}>Retry</button>
          </div>
        )}

        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
            <User size={18} style={{ color: BLUE }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{loading ? "Loading participant..." : participant?.name ?? "Participant"}</p>
            <p className="text-xs text-gray-400">Participant ID: {participant?.participant_code ?? "-"}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: error ? "#FEE2E2" : "#DCFCE7", color: error ? "#B91C1C" : "#15803D" }}>{error ? "Offline" : "Active"}</span>
        </div>

        <button disabled={loading || !!starting} onClick={() => startSession("relaxed")} className={`w-full text-left ${loading || starting ? "opacity-70" : ""}`}>
          <div className="rounded-2xl p-4 shadow-sm border border-green-100 overflow-hidden relative" style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white/70 flex items-center justify-center shrink-0">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#DCFCE7" }}>
                  <Activity size={30} style={{ color: GREEN }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Relaxed Session</h3>
                <p className="text-xs text-gray-600 leading-relaxed mt-1">Record data in a calm and relaxed state.</p>
                <p className="text-xs text-gray-500 mt-3">Duration: ~15 min</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: GREEN }}>
                <ChevronRight size={18} className="text-white" />
              </div>
            </div>
          </div>
        </button>

        <button disabled={loading || !!starting} onClick={() => startSession("stress")} className={`w-full text-left ${loading || starting ? "opacity-70" : ""}`}>
          <div className="rounded-2xl p-4 shadow-sm border border-red-100 overflow-hidden relative" style={{ background: "linear-gradient(135deg, #FFF7ED 0%, #FEE2E2 100%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white/70 flex items-center justify-center shrink-0">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FFEDD5" }}>
                  <Brain size={30} style={{ color: ORANGE }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Stress Session</h3>
                <p className="text-xs text-gray-600 leading-relaxed mt-1">Perform stress tasks and record data.</p>
                <p className="text-xs text-gray-500 mt-3">Duration: ~15 min</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ORANGE }}>
                <ChevronRight size={18} className="text-white" />
              </div>
            </div>
          </div>
        </button>
      </ScrollArea>
      <BottomTabs active="select-session" nav={nav} />
    </div>
  )
}
// SCREEN 8 â€” Relaxed Instructions
function RelaxedInstructionsScreen({ nav }: { nav: Nav }) {
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Relaxed Session" onBack={() => nav("select-session")} />
      <ScrollArea className="px-4 py-5 space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "#DCFCE7" }}>
            <Activity size={30} style={{ color: GREEN }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Keep calm and relax</h2>
          <p className="text-sm text-gray-500 text-center mt-1">Follow these instructions before and during recording.</p>
        </div>

        <Card className="p-4 space-y-3">
          {[
            ["1", "Sit comfortably in a chair with your back supported."],
            ["2", "Relax your body â€” drop your shoulders and unclench your jaw."],
            ["3", "Do not talk during the physiological recording phase."],
            ["4", "Keep all sensor cables and devices connected throughout."],
            ["5", "Breathe normally â€” do not control your breathing artificially."],
          ].map(([n, t]) => (
            <div key={n} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: GREEN }}>{n}</div>
              <p className="text-sm text-gray-700 leading-relaxed">{t}</p>
            </div>
          ))}
        </Card>

        {/* Duration card */}
        <Card className="p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Session Structure</p>
          <div className="space-y-2">
            {[
              { icon: Activity,  label: "Physiological Recording", dur: "5 minutes",  color: GREEN  },
              { icon: Mic,       label: "Audio Recording",         dur: "~30 seconds", color: ORANGE },
              { icon: FileText,  label: "Questionnaire",           dur: "~5 minutes", color: BLUE   },
            ].map(({ icon: Icon, label, dur, color }) => (
              <div key={label} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: `${color}15` }}>
                <Icon size={16} style={{ color }} />
                <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{dur}</span>
              </div>
            ))}
          </div>
        </Card>

        <Btn onClick={() => nav("relaxed-recording", { sessionType: "relaxed" })} color={GREEN}>Start Relaxed Session</Btn>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 9 â€” Relaxed Recording
function RelaxedRecordingScreen({ nav }: { nav: Nav }) {
  const [seconds, setSeconds] = useState(275)
  const [running, setRunning] = useState(true)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds(s => s > 0 ? s - 1 : 0), 1000)
    return () => clearInterval(id)
  }, [running])
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0")
  const secs = String(seconds % 60).padStart(2, "0")
  const pct = (seconds / 300) * 100
  const signals = [
    { label: "Heart Rate", value: "72", unit: "bpm",  sparkType: "heart", color: RED   },
    { label: "HRV (RMSSD)", value: "48", unit: "ms",   sparkType: "hrv",   color: BLUE  },
    { label: "EDA",         value: "2.35",unit: "ÂµS",  sparkType: "eda",   color: TEAL  },
    { label: "Temperature", value: "36.6",unit: "Â°C",  sparkType: "temp",  color: ORANGE},
    { label: "Respiration", value: "14", unit: "brpm", sparkType: "resp",  color: "#7C3AED"},
    { label: "ECG",         value: "Live",unit: "",    sparkType: "ecg",   color: RED   },
  ]
  const displaySignals = [
    { label: "HR",   value: "72",   unit: "bpm", sparkType: "heart", color: RED },
    { label: "HRV",  value: "48",   unit: "ms",  sparkType: "hrv",   color: BLUE },
    { label: "GSR",  value: "0.41", unit: "kÎ©",  sparkType: "eda",   color: TEAL },
    { label: "EDA",  value: "2.35", unit: "ÂµS",  sparkType: "eda",   color: TEAL },
    { label: "TEMP", value: "36.6", unit: "Â°C",  sparkType: "temp",  color: ORANGE },
    { label: "ECG",  value: "Live", unit: "",    sparkType: "ecg",   color: RED },
  ]
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Relaxed Session" subtitle="Keep calm and relax" onBack={() => nav("relaxed-instructions")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        {/* Timer */}
        <Card className="p-5 flex flex-col items-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Remaining Time</p>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E2E8F0" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={GREEN} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{mins}:{secs}</p>
              <p className="text-xs text-gray-400">remaining</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: GREEN }} />
            <span className="text-xs font-semibold" style={{ color: GREEN }}>Recording in progress</span>
          </div>
          <div className="flex gap-2 mt-3 w-full">
            <button onClick={() => setRunning(!running)} className="flex-1 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 border-gray-200">
              {running ? <Pause size={14} /> : <Play size={14} />}{running ? "Pause" : "Resume"}
            </button>
          </div>
        </Card>

        {/* Status strip */}
        <div className="hidden">
          <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-2">
            <Battery size={16} className="text-green-500" />
            <div><p className="text-xs text-gray-400">Battery</p><p className="text-sm font-bold text-gray-800">88%</p></div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: GREEN }} />
            <div><p className="text-xs text-gray-400">Signal Quality</p><p className="text-sm font-bold" style={{ color: GREEN }}>Good</p></div>
          </div>
        </div>

        {/* Signal grid */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-0.5">Live Signals</p>
          <div className="grid grid-cols-2 gap-2">
            {displaySignals.map(s => <SignalCard key={s.label} {...s} />)}
          </div>
        </div>

        {/* Stop button */}
        <button onClick={async () => { await api.savePhysiological("relaxed"); nav("audio-recording", { sessionType: "relaxed" }) }} className="w-full py-3.5 rounded-xl font-semibold text-white text-[15px] flex items-center justify-center gap-2" style={{ backgroundColor: RED }}>
          <Square size={16} />Stop Session
        </button>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 10 â€” Stress Task Select
function StressTaskSelectScreen({ nav }: { nav: Nav }) {
  const [selected, setSelected] = useState(0)
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Stress Task" onBack={() => nav("select-session")} />
      <ScrollArea className="px-4 py-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Choose stress induction task</h2>
          <p className="text-sm text-gray-500 mt-0.5">Select one task to perform during the stress session.</p>
        </div>
        <div className="space-y-3">
          {STRESS_TASKS.map((t, i) => (
            <button key={t.title} onClick={() => setSelected(i)} className="w-full text-left">
              <div className={`p-4 rounded-2xl border-2 transition-all ${selected === i ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-white"}`}>
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black shrink-0" style={{ backgroundColor: selected === i ? "#FFEDD5" : "#EEF2F7", color: ORANGE }}>{t.badge}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === i ? "border-orange-500" : "border-gray-300"}`}>
                    {selected === i && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ORANGE }} />}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Card className="p-3 flex items-start gap-2 border-orange-100" style={{ backgroundColor: "#FFF7ED" }}>
          <AlertCircle size={15} style={{ color: ORANGE, flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs text-orange-700">Physiological signals will be recorded throughout the entire stress session.</p>
        </Card>
        <Btn onClick={() => nav("stress-task", { task: selected })} color={ORANGE}>Start Stress Task</Btn>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 11 â€” Stress Task
function StressTaskScreen({ nav, task = 0 }: { nav: Nav; task?: number }) {
  const [timeLeft, setTimeLeft] = useState(45)
  const [number, setNumber] = useState(812)
  const [promptIndex, setPromptIndex] = useState(0)
  const [running, setRunning] = useState(true)
  const taskData = STRESS_TASKS[task] ?? STRESS_TASKS[0]
  const stroopItems = [
    { word: "BLUE", ink: ORANGE, answer: "Orange" },
    { word: "RED", ink: BLUE, answer: "Blue" },
    { word: "GREEN", ink: RED, answer: "Red" },
    { word: "ORANGE", ink: GREEN, answer: "Green" },
  ]
  const memoryItems = ["729418", "3849207", "65180724", "942761305"]
  const pressureItems = ["18 + 27 - 9", "64 - 18 + 7", "9 × 6 - 11", "120 ÷ 5 + 19"]
  const activeStroop = stroopItems[promptIndex % stroopItems.length]
  const activeMemory = memoryItems[promptIndex % memoryItems.length]
  const activePressure = pressureItems[promptIndex % pressureItems.length]
  const handleTaskAction = () => {
    if (task === 0) setNumber(n => n - 17)
    else setPromptIndex(i => i + 1)
  }
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000)
    return () => clearInterval(id)
  }, [running])
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Stress Session" subtitle={STRESS_TASKS[task]?.title ?? "Mental Arithmetic"} onBack={() => nav("stress-task-select")} />
      <ScrollArea className="px-4 py-5 space-y-4">
        {/* Instruction */}
        <Card className="p-4" style={{ borderLeft: `4px solid ${ORANGE}` }}>
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{taskData.instruction}</p>
        </Card>

        {/* Number display */}
        <Card className="p-6 flex flex-col items-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{taskData.title}</p>
          {task === 0 && <p className="text-6xl font-black text-gray-900 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: ORANGE }}>{number}</p>}
          {task === 1 && (
            <div className="text-center">
              <p className="text-5xl font-black tracking-widest" style={{ color: activeStroop.ink }}>{activeStroop.word}</p>
              <p className="text-xs text-gray-400 mt-2">Correct response: ink color = {activeStroop.answer}</p>
            </div>
          )}
          {task === 2 && <p className="text-5xl font-black tracking-widest tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: ORANGE }}>{activeMemory}</p>}
          {task === 3 && <p className="text-4xl font-black tabular-nums text-center" style={{ fontFamily: "'JetBrains Mono', monospace", color: ORANGE }}>{activePressure}</p>}
          <button onClick={handleTaskAction} className="mt-4 px-8 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: ORANGE }}>{taskData.button}</button>
        </Card>

        {/* Timer */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time Left</p>
            <button onClick={() => setRunning(!running)} className="text-gray-400">{running ? <Pause size={16} /> : <Play size={16} />}</button>
          </div>
          <p className="text-4xl font-black tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: timeLeft < 15 ? RED : ORANGE }}>
            00:{String(timeLeft).padStart(2, "0")}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(timeLeft / 45) * 100}%`, backgroundColor: timeLeft < 15 ? RED : ORANGE }} />
          </div>
        </Card>

        <Card className="p-3 flex items-start gap-2" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
          <Radio size={14} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs font-semibold text-red-700">Your physiological signals are being recorded.</p>
        </Card>

        <Btn onClick={() => nav("stress-recording")} color={ORANGE}>Continue to Recording</Btn>
        <Btn onClick={() => nav("stress-recording")} variant="ghost" color={RED}>I Give Up</Btn>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 12 â€” Stress Recording
function StressRecordingScreen({ nav }: { nav: Nav }) {
  const [seconds, setSeconds] = useState(275)
  const [running, setRunning] = useState(true)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds(s => s > 0 ? s - 1 : 0), 1000)
    return () => clearInterval(id)
  }, [running])
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0")
  const secs = String(seconds % 60).padStart(2, "0")
  const pct = (seconds / 300) * 100
  const signals = [
    { label: "ECG",          value: "Live", unit: "",     sparkType: "ecg",   color: RED    },
    { label: "Heart Rate",   value: "94",   unit: "bpm",  sparkType: "heart", color: RED    },
    { label: "HRV (RMSSD)",  value: "28",   unit: "ms",   sparkType: "hrv",   color: ORANGE },
    { label: "EDA",          value: "5.12", unit: "ÂµS",   sparkType: "eda",   color: ORANGE },
    { label: "Temperature",  value: "37.1", unit: "Â°C",   sparkType: "temp",  color: "#7C3AED"},
    { label: "Respiration",  value: "21",   unit: "brpm", sparkType: "resp",  color: TEAL   },
    { label: "Accelerometer",value: "0.42", unit: "g",    sparkType: "accel", color: BLUE   },
  ]
  const displaySignals = [
    { label: "HR",   value: "94",   unit: "bpm", sparkType: "heart", color: RED },
    { label: "HRV",  value: "28",   unit: "ms",  sparkType: "hrv",   color: ORANGE },
    { label: "GSR",  value: "0.63", unit: "kÎ©",  sparkType: "eda",   color: TEAL },
    { label: "EDA",  value: "5.12", unit: "ÂµS",  sparkType: "eda",   color: ORANGE },
    { label: "TEMP", value: "37.1", unit: "Â°C",  sparkType: "temp",  color: "#7C3AED" },
    { label: "ECG",  value: "Live", unit: "",    sparkType: "ecg",   color: RED },
  ]
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Stress Session" subtitle="Physiological Recording" onBack={() => nav("stress-task")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        <Card className="p-3 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: RED }} />
          <p className="text-xs font-bold text-red-700">Stress condition recording in progress.</p>
        </Card>

        <Card className="p-5 flex flex-col items-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Remaining Time</p>
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#FEE2E2" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={RED} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: RED }}>{mins}:{secs}</p>
            </div>
          </div>
          <div className="hidden">
            <div className="text-center p-2 rounded-xl bg-red-50">
              <p className="text-xs text-gray-400">Battery</p><p className="text-sm font-bold" style={{ color: RED }}>82%</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-red-50">
              <p className="text-xs text-gray-400">Signal</p><p className="text-sm font-bold" style={{ color: ORANGE }}>Moderate</p>
            </div>
          </div>
        </Card>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-0.5">Live Signals</p>
          <div className="grid grid-cols-2 gap-2">
            {displaySignals.map(s => <SignalCard key={s.label} {...s} />)}
          </div>
        </div>

        <button onClick={async () => { await api.savePhysiological("stress"); nav("audio-recording", { sessionType: "stress" }) }} className="w-full py-3.5 rounded-xl font-semibold text-white text-[15px] flex items-center justify-center gap-2" style={{ backgroundColor: RED }}>
          <Square size={16} />Stop Recording
        </button>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 13 â€” Questionnaire
function AudioRecordingScreen({ nav, sessionType }: { nav: Nav; sessionType: SessionType }) {
  const isRelaxed = sessionType === "relaxed"
  const color = isRelaxed ? GREEN : ORANGE
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState("")
  const [error, setError] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = async () => {
    setError("")
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser.")
      return
    }
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl("")
      setElapsed(0)
      chunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      recorder.start()
      setRecording(true)
    } catch {
      setError("Microphone permission was blocked. Allow microphone access and try again.")
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
    setRecording(false)
  }

  const saveAndContinue = () => {
    if (recording) stopRecording()
    localStorage.setItem(`stresssense_audio_${api.activeSessionId ?? "current"}`, "collected")
    nav("questionnaire", { sessionType })
  }

  const timeText = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  const bars = [18, 34, 24, 52, 31, 68, 42, 26, 58, 36, 74, 46, 30, 62, 40, 20]

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar
        title="Audio Recording"
        subtitle={isRelaxed ? "Relaxed session voice sample" : "Stress session voice sample"}
        onBack={() => nav(isRelaxed ? "relaxed-recording" : "stress-recording", { sessionType })}
      />
      <ScrollArea className="px-4 py-5 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
              <Mic size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Voice sample collection</p>
              <p className="text-xs text-gray-400">Read the paragraph clearly in your normal voice.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-700 leading-relaxed">{AUDIO_PROMPT}</p>
          </div>
        </Card>

        <Card className="p-5 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recording Status</p>
          <div className="flex items-end justify-center gap-1 h-20 mb-4">
            {bars.map((height, index) => (
              <div
                key={index}
                className={`w-2 rounded-full ${recording ? "animate-pulse" : ""}`}
                style={{
                  height,
                  backgroundColor: recording || audioUrl ? color : "#CBD5E1",
                  animationDelay: `${index * 70}ms`,
                }}
              />
            ))}
          </div>
          <p className="text-3xl font-black tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color }}>{timeText}</p>
          <p className="text-xs text-gray-400 mt-1">{recording ? "Recording..." : audioUrl ? "Recording captured" : "Ready to record"}</p>
          {audioUrl && <audio className="w-full mt-4" controls src={audioUrl} />}
        </Card>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!recording ? (
            <Btn onClick={startRecording} color={color} sm>{audioUrl ? "Record Again" : "Start Recording"}</Btn>
          ) : (
            <Btn onClick={stopRecording} color={RED} sm><Square size={15} /> Stop</Btn>
          )}
          <Btn onClick={() => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(""); setElapsed(0); setError("") }} variant="outline" color="#64748B" sm>
            <RotateCcw size={15} /> Restart
          </Btn>
        </div>

        <Btn onClick={saveAndContinue} color={BLUE}>Save Audio & Continue</Btn>
        <p className="text-[11px] text-center text-gray-400 px-4">Audio is collected only inside the participant app flow and is not shown on the researcher dashboard.</p>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

function QuestionnaireScreen({ nav }: { nav: Nav }) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>(() => new Array(QUESTIONS.length).fill(-1))
  const [error, setError] = useState("")
  const current = QUESTIONS[idx]
  const opts = ["0 — Never", "1 — Rarely", "2 — Sometimes", "3 — Often", "4 — Always"]
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Questionnaire" onBack={() => nav("audio-recording")}
        right={<span className="text-blue-200 text-xs font-bold">{idx + 1}/{QUESTIONS.length}</span>} />
      <ScrollArea className="px-4 py-4 space-y-4">
        <Card className="p-4" style={{ borderLeft: `4px solid ${BLUE}` }}>
          <p className="text-sm font-black text-gray-900">Multimodal Stress Assessment Questionnaire (MSAQ)</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">Please indicate how frequently you experienced each of the following during the past seven days.</p>
          <p className="text-[11px] text-gray-400 mt-2">Scale: 0 Never · 1 Rarely · 2 Sometimes · 3 Often · 4 Always</p>
        </Card>
        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 font-medium mb-1.5">
            <span>Question {idx + 1} of {QUESTIONS.length}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#EBF3FF", color: BLUE }}>{current.cat}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${((idx + 1) / QUESTIONS.length) * 100}%`, backgroundColor: BLUE }} />
          </div>
        </div>

        {/* Question */}
        <Card className="p-5">
          <p className="text-base font-semibold text-gray-900 leading-relaxed">{current.q}</p>
          {current.reverse && <p className="text-[11px] font-semibold mt-3" style={{ color: TEAL }}>Reverse scored item</p>}
        </Card>

        {/* Options */}
        <div className="space-y-2">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => { const a = [...answers]; a[idx] = i; setAnswers(a) }}
              className={`w-full p-3.5 rounded-xl border-2 text-left text-sm font-medium transition-all flex items-center gap-3 ${answers[idx] === i ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-100 bg-white text-gray-700"}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${answers[idx] === i ? "border-blue-500" : "border-gray-300"}`}>
                {answers[idx] === i && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BLUE }} />}
              </div>
              {opt}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <Btn onClick={() => setIdx(Math.max(0, idx - 1))} variant="outline" color="#64748B" sm>Previous</Btn>
          <Btn onClick={async () => {
            setError("")
            if (answers[idx] < 0) {
              setError("Please answer this question before continuing.")
              return
            }
            if (idx < QUESTIONS.length - 1) setIdx(idx + 1)
            else {
              const attempted = answers.filter((value) => value >= 0).length
              const score = answers.reduce((sum, value, index) => {
                const raw = Math.max(0, value)
                return sum + (QUESTIONS[index].reverse ? 4 - raw : raw)
              }, 0)
              localStorage.setItem("stresssense_questionnaire_attempted", String(attempted))
              localStorage.setItem("stresssense_questionnaire_total", String(QUESTIONS.length))
              await api.saveQuestionnaire(score, Object.fromEntries(QUESTIONS.map((question, index) => {
                const raw = Math.max(0, answers[index] ?? 0)
                return [question.id, {
                  section: question.cat,
                  question: question.q,
                  raw_score: raw,
                  scored_value: question.reverse ? 4 - raw : raw,
                  reverse_scored: Boolean(question.reverse),
                }]
              })))
              nav("questionnaire-complete")
            }
          }} color={BLUE} sm>{idx === QUESTIONS.length - 1 ? "Finish" : "Next"}</Btn>
        </div>
        {error && <p className="text-xs font-semibold text-red-600 text-center">{error}</p>}
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 15 â€” Questionnaire Complete
function QuestionnaireCompleteScreen({ nav }: { nav: Nav }) {
  const attempted = Number(localStorage.getItem("stresssense_questionnaire_attempted") || QUESTIONS.length)
  const total = Number(localStorage.getItem("stresssense_questionnaire_total") || QUESTIONS.length)
  const done = attempted === total
  const score = attempted
  const max = total
  const pct = total > 0 ? Math.round((attempted / total) * 100) : 0
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Questionnaire" onBack={() => nav("select-session")} />
      <ScrollArea className="px-4 py-8 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-md" style={{ backgroundColor: "#DCFCE7" }}>
          <Check size={36} style={{ color: GREEN }} strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>All Done!</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Questionnaire completed. Your responses have been recorded.</p>

        <Card className="p-5 w-full mb-6">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Questionnaire Status</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 rounded-xl bg-blue-50">
              <p className="text-3xl font-black" style={{ color: BLUE }}>{attempted}/{total}</p>
              <p className="text-xs text-gray-500 mt-1">Questions attempted</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-green-50">
              <p className="text-3xl font-black" style={{ color: GREEN }}>{done ? "Done" : "Pending"}</p>
              <p className="text-xs text-gray-500 mt-1">Completion</p>
            </div>
          </div>
        </Card>

        <Card className="hidden">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Stress Score</p>
          <div className="flex items-end justify-center gap-2 mb-3">
            <span className="text-5xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: BLUE }}>{score}</span>
            <span className="text-2xl font-bold text-gray-300 mb-1">/ {max * 4}</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 mb-2">
            <div className="h-3 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GREEN}, ${ORANGE})` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>None</span><span>Moderate</span><span>Extreme</span>
          </div>
          <div className="mt-3 p-3 rounded-xl text-center" style={{ backgroundColor: "#EBF3FF" }}>
            <p className="text-sm font-bold" style={{ color: BLUE }}>Low â€” Within Normal Range</p>
          </div>
        </Card>

        <div className="hidden">
          {[["20", "Questions", BLUE], ["6", "Categories", TEAL], ["12", "Score", ORANGE], ["100%", "Complete", GREEN]].map(([v, l, c]) => (
            <Card key={l} className="p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: c as string }}>{v}</p>
              <p className="text-xs text-gray-400 mt-0.5">{l}</p>
            </Card>
          ))}
        </div>

        <Btn onClick={() => nav("session-summary")} color={BLUE}>Continue to Summary</Btn>
      </ScrollArea>
    </div>
  )
}

// SCREEN 16 â€” Session Summary
function SessionSummaryScreen({ nav, sessionType }: { nav: Nav; sessionType: SessionType }) {
  const isRelaxed = sessionType === "relaxed"
  const color = isRelaxed ? GREEN : ORANGE
  const participant = api.currentParticipant
  const sessionCode = api.activeSessionCode ?? "Current"
  const attempted = Number(localStorage.getItem("stresssense_questionnaire_attempted") || QUESTIONS.length)
  const total = Number(localStorage.getItem("stresssense_questionnaire_total") || QUESTIONS.length)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const items = [
    { icon: Activity, label: "Physiological Data",  status: "Collected",  ok: true  },
    { icon: Mic,      label: "Audio Recording",     status: "Collected",  ok: true  },
    { icon: FileText, label: "Questionnaire",        status: `${attempted}/${total} Done`,  ok: attempted === total  },
  ]
  const finishSession = async () => {
    setSaving(true)
    setError("")
    try {
      await api.completeSession()
      api.activeSessionId = null
      api.activeSessionCode = null
      nav("select-session")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish session. Please try again.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Session Summary" onBack={() => nav("select-session")} />
      <ScrollArea className="px-4 py-5 space-y-4">
        {/* Session header */}
        <div className="p-4 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${color}, ${isRelaxed ? TEAL : RED})` }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black px-2 py-1 rounded bg-white/20">{isRelaxed ? "REL" : "STR"}</span>
            <span className="text-sm font-bold opacity-90">{isRelaxed ? "RELAXED SESSION" : "STRESS SESSION"}</span>
          </div>
          <p className="text-2xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Session Completed</p>
          <p className="text-sm opacity-75 mt-0.5">Session ID: {sessionCode} Â· Participant: {participant?.participant_code ?? "â€”"}</p>
          <p className="text-xs opacity-60 mt-0.5">{new Date().toLocaleString("en-GB")}</p>
        </div>

        {/* Checklist */}
        <SectionCard title="Data Collection Checklist">
          {items.map(({ icon: Icon, label, status, ok }) => (
            <div key={label} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ok ? "#EBF3FF" : "#FFF7ED" }}>
                <Icon size={15} style={{ color: ok ? BLUE : ORANGE }} />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
              <StatusBadge status={status} />
            </div>
          ))}
        </SectionCard>

        {/* Signal quality */}
        <div className="hidden">
        <SectionCard title="Signal Quality Summary">
          <div className="grid grid-cols-3 gap-2 py-2">
            {[["ECG", "Good"], ["HRV", "Good"], ["EDA", "Good"], ["Temp", "Good"], ["Q-Score", "12/80"]].map(([l, v]) => (
              <div key={l} className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400">{l}</p>
                <p className="text-xs font-bold mt-0.5" style={{ color: v === "Good" || v === "Collected" ? GREEN : BLUE }}>{v}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">{error}</p>
          </div>
        )}
        <Btn onClick={finishSession} color={BLUE}>{saving ? "Saving..." : "Finish & Save"}</Btn>
        <Btn onClick={() => nav("history")} variant="ghost" color={BLUE}>View History</Btn>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 17 â€” History
function HistoryScreen({ nav }: { nav: Nav }) {
  const [myS, setMyS] = useState<Awaited<ReturnType<typeof api.getMySessions>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsLogin, setNeedsLogin] = useState(false)

  const loadHistory = async () => {
    setLoading(true)
    setError("")
    setNeedsLogin(false)
    try {
      if (!api.isSignedIn()) {
        setNeedsLogin(true)
        setMyS([])
        return
      }
      const rows = await api.getMySessions()
      setMyS(rows)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load session history"
      if (message.includes("401") || message.toLowerCase().includes("not authenticated") || message.toLowerCase().includes("token")) {
        setNeedsLogin(true)
      }
      setError(message)
      setMyS([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const openSummary = (session: Awaited<ReturnType<typeof api.getMySessions>>[number]) => {
    api.useSession(session.rawId, session.id)
    nav("session-summary", { sessionType: session.cond === "Stress" ? "stress" : "relaxed" })
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="History" right={<button onClick={loadHistory} disabled={loading}><RotateCcw size={18} className={`text-white ${loading ? "animate-spin" : ""}`} /></button>} />
      <ScrollArea className="px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium">Your previous sessions</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Synced from backend session records.</p>
          </div>
          {!loading && myS.length > 0 && <StatusBadge status={`${myS.length} sessions`} />}
        </div>

        {loading && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
                <RotateCcw size={17} className="animate-spin" style={{ color: BLUE }} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Loading history</p>
                <p className="text-xs text-gray-400 mt-0.5">Reading your sessions from MongoDB...</p>
              </div>
            </div>
          </Card>
        )}

        {!loading && needsLogin && (
          <Card className="p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <User size={20} style={{ color: BLUE }} />
            </div>
            <p className="text-sm font-bold text-gray-800">Sign in required</p>
            <p className="text-xs text-gray-400 mt-1">History belongs to one participant account. Please login or create an account first.</p>
            <button onClick={() => nav("login")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Go to login</button>
          </Card>
        )}

        {!loading && !needsLogin && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">History could not load</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={loadHistory} className="text-xs font-bold mt-2" style={{ color: RED }}>Retry</button>
          </div>
        )}

        {!loading && !needsLogin && !error && myS.length === 0 && (
          <Card className="p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <Clock size={20} style={{ color: BLUE }} />
            </div>
            <p className="text-sm font-bold text-gray-800">No session history yet</p>
            <p className="text-xs text-gray-400 mt-1">Start a relaxed or stress session. Once saved, it will show here from the backend.</p>
            <button onClick={() => nav("select-session")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Start first session</button>
          </Card>
        )}

        {!loading && !needsLogin && !error && myS.map(s => {
          const isRelaxed = s.cond === "Relaxed"
          const color = isRelaxed ? GREEN : ORANGE
          const complete = s.q
          const bits: { k: string; v: boolean | null }[] = [
            { k: "HR", v: s.ecg }, { k: "HRV", v: s.hrv }, { k: "GSR", v: s.eda },
            { k: "EDA", v: s.eda }, { k: "Temp", v: s.temp }, { k: "ECG", v: s.ecg }, { k: "Q", v: s.q },
          ]
          return (
            <Card key={s.rawId ?? s.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#64748B" }}>{s.id}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>{s.cond}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{s.date}</p>
                </div>
                <StatusBadge status={complete ? "Completed" : s.quality} />
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {bits.map(b => (
                  <div key={b.k} className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ backgroundColor: b.v ? "#F0FDF4" : "#FEF2F2" }}>
                    <span className="text-[10px] font-semibold" style={{ color: b.v ? GREEN : RED }}>{b.k}</span>
                    <span className="text-[10px] font-bold" style={{ color: b.v ? GREEN : RED }}>{b.v ? "OK" : "X"}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={complete ? "Completed" : "Incomplete"} />
                <span className="text-xs text-gray-400">Session record</span>
                <button onClick={() => openSummary(s)} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: BLUE }}>
                  View Summary <ChevronRight size={12} />
                </button>
              </div>
            </Card>
          )
        })}
      </ScrollArea>
      <BottomTabs active="history" nav={nav} />
    </div>
  )
}
// SCREEN 18 â€” Participant Dashboard
function ParticipantDashboardScreen({ nav }: { nav: Nav }) {
  const [home, setHome] = useState<Awaited<ReturnType<typeof api.getParticipantHome>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsLogin, setNeedsLogin] = useState(false)

  const loadDashboard = async () => {
    setLoading(true)
    setError("")
    setNeedsLogin(false)
    try {
      if (!api.isSignedIn()) {
        setNeedsLogin(true)
        setHome(null)
        return
      }
      const data = await api.getParticipantHome()
      setHome(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load dashboard"
      if (message.includes("401") || message.toLowerCase().includes("not authenticated") || message.toLowerCase().includes("token")) {
        setNeedsLogin(true)
      }
      setError(message)
      setHome(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const sessions = home?.sessions ?? []
  const completed = home?.completed ?? 0
  const relaxed = home?.relaxed ?? 0
  const stress = home?.stress ?? 0
  const last = home?.last ?? "-"
  const total = sessions.length
  const requiredSessions = 2
  const completedSessions = sessions.filter(s => s.q)
  const protocolRelaxedDone = completedSessions.some(s => s.cond === "Relaxed")
  const protocolStressDone = completedSessions.some(s => s.cond === "Stress")
  const protocolCompleted = Number(protocolRelaxedDone) + Number(protocolStressDone)
  const progress = Math.round((protocolCompleted / requiredSessions) * 100)
  const sensorSynced = sessions.filter(s => s.ecg || s.hrv || s.eda || s.temp).length
  const questionnaireSynced = sessions.filter(s => s.q).length
  const pendingSessions = sessions.filter(s => !(s.q))
  const chartData = [
    { month: "Relaxed", sessions: relaxed },
    { month: "Stress", sessions: stress },
    { month: "Protocol", sessions: protocolCompleted },
    { month: "Remaining", sessions: Math.max(0, requiredSessions - protocolCompleted) },
  ]
  const nextCondition = !protocolRelaxedDone ? "Relaxed" : !protocolStressDone ? "Stress" : "Optional repeat"

  const sessionStatus = (session: Awaited<ReturnType<typeof api.getMySessions>>[number]) => {
    if (session.q && (session.ecg || session.hrv || session.eda || session.temp)) return ["Synced", GREEN]
    const missing = [
      !(session.ecg || session.hrv || session.eda || session.temp) ? "Sensors" : "",
      !session.q ? "Questionnaire" : "",
    ].filter(Boolean).join(", ")
    return [`Missing ${missing || "data"}`, ORANGE]
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="My Dashboard" right={<button onClick={loadDashboard} disabled={loading}><RotateCcw size={18} className={`text-white ${loading ? "animate-spin" : ""}`} /></button>} />
      <ScrollArea className="px-4 py-4 pb-24 space-y-3">
        {loading && (
          <Card className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <RotateCcw size={17} className="animate-spin" style={{ color: BLUE }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Loading dashboard</p>
              <p className="text-xs text-gray-400">Fetching participant sessions from backend.</p>
            </div>
          </Card>
        )}

        {!loading && needsLogin && (
          <Card className="p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <User size={20} style={{ color: BLUE }} />
            </div>
            <p className="text-sm font-bold text-gray-800">Sign in required</p>
            <p className="text-xs text-gray-400 mt-1">Dashboard data is connected to one participant account.</p>
            <button onClick={() => nav("login")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Go to login</button>
          </Card>
        )}

        {!loading && !needsLogin && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">Dashboard could not load</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={loadDashboard} className="text-xs font-bold mt-2" style={{ color: RED }}>Retry</button>
          </div>
        )}

        {!loading && !needsLogin && !error && (
          <>
            <div className="p-3.5 rounded-xl flex items-center gap-3" style={{ background: `linear-gradient(90deg, #EBF3FF, #F0F7FF)`, border: `1px solid #BFDBFE` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BLUE }}>
                <Clock size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{total ? (nextCondition === "Optional repeat" ? "Protocol complete - optional repeat only" : `Next required: ${nextCondition}`) : "Start with a relaxed session"}</p>
                <p className="text-xs text-gray-500">Participant {home?.participant?.participant_code ?? "-"} - {total} total sessions recorded</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                [String(completed), "Completed", BLUE], [String(relaxed), "Relaxed", GREEN],
                [String(stress), "Stress", ORANGE], [last.split(",")[0] || "-", "Last Session", TEAL],
              ].map(([v, l, c]) => (
                <Card key={l} className="p-3.5">
                  <p className="text-2xl font-black break-words" style={{ color: c as string, fontFamily: "'JetBrains Mono', monospace" }}>{v}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l}</p>
                </Card>
              ))}
            </div>

            <Card className="p-4">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-bold text-gray-800">Study Completion</p>
                <span className="text-sm font-bold" style={{ color: BLUE }}>{progress}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 mb-1">
                <div className="h-3 rounded-full" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${BLUE}, ${TEAL})` }} />
              </div>
              <p className="text-xs text-gray-400">{protocolCompleted} of {requiredSessions} required sessions completed: Relaxed + Stress</p>
              <div className="flex gap-2 mt-3">
                {[{ label: "Relaxed", done: protocolRelaxedDone }, { label: "Stress", done: protocolStressDone }].map((slot) => (
                  <div key={slot.label} className="flex-1 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                    style={{ backgroundColor: slot.done ? "#DCFCE7" : "#F1F5F9", color: slot.done ? GREEN : "#94A3B8" }}>{slot.label}{slot.done ? " OK" : ""}</div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Session Overview</p>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={chartData} barSize={22}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="sessions" fill={BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Dataset Readiness</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [String(sensorSynced), "Sensor"], [String(questionnaireSynced), "Questionnaire"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-2">
                    <p className="text-lg font-black text-gray-900">{value}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Data Upload Status</p>
                <button onClick={() => nav("history")} className="text-xs font-bold" style={{ color: BLUE }}>History</button>
              </div>
              {sessions.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-sm font-bold text-gray-800">No sessions yet</p>
                  <p className="text-xs text-gray-400 mt-1">Start a relaxed or stress session to create backend records.</p>
                  <button onClick={() => nav("select-session")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Start session</button>
                </div>
              )}
              {sessions.slice(0, 5).map(session => {
                const [status, color] = sessionStatus(session)
                return (
                  <div key={session.rawId ?? session.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700">{session.id} - {session.cond}</p>
                      <p className="text-[11px] text-gray-400 truncate">{session.date}</p>
                    </div>
                    <span className="text-xs font-semibold text-right" style={{ color }}>{status}</span>
                  </div>
                )
              })}
            </Card>
          </>
        )}
      </ScrollArea>
      <BottomTabs active="participant-dashboard" nav={nav} />
    </div>
  )
}
// SCREEN 19 â€” Profile View
function ProfileViewScreen({ nav }: { nav: Nav }) {
  const [participant, setParticipant] = useState(api.currentParticipant)
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof api.getProfile>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsLogin, setNeedsLogin] = useState(false)
  const [missingProfile, setMissingProfile] = useState(false)

  const loadProfile = async () => {
    setLoading(true)
    setError("")
    setNeedsLogin(false)
    setMissingProfile(false)
    try {
      if (!api.isSignedIn()) {
        setNeedsLogin(true)
        setParticipant(null)
        setProfile(null)
        return
      }
      const user = await api.me()
      setParticipant(user)
      try {
        const savedProfile = await api.getProfile()
        setProfile(savedProfile)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Profile has not been completed"
        if (message.toLowerCase().includes("profile has not been completed") || message.includes("404")) {
          setMissingProfile(true)
          setProfile(null)
        } else {
          throw err
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load profile"
      if (message.includes("401") || message.toLowerCase().includes("not authenticated") || message.toLowerCase().includes("token")) {
        setNeedsLogin(true)
      }
      setError(message)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  const logout = () => {
    api.logout()
    setParticipant(null)
    setProfile(null)
    nav("splash")
  }

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="My Profile" right={<button onClick={loadProfile} disabled={loading}><RotateCcw size={18} className={`text-blue-200 ${loading ? "animate-spin" : ""}`} /></button>} />
      <ScrollArea className="px-4 py-4 pb-24 space-y-3">
        <div className="flex flex-col items-center py-4">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-3 shadow border-4 border-white">
            <User size={32} style={{ color: BLUE }} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{loading ? "Loading..." : participant?.name ?? "Participant"}</h2>
          <p className="text-sm text-gray-500">Participant ID: {participant?.participant_code ?? "-"}</p>
          <p className="max-w-[260px] text-center text-xs text-gray-400 break-all leading-snug">{participant?.email ?? ""}</p>
          <div className="mt-2"><StatusBadge status={needsLogin ? "Missing" : missingProfile ? "Pending" : "Active"} /></div>
        </div>

        {loading && (
          <Card className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <RotateCcw size={17} className="animate-spin" style={{ color: BLUE }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Loading profile</p>
              <p className="text-xs text-gray-400">Fetching participant and profile data from backend.</p>
            </div>
          </Card>
        )}

        {!loading && needsLogin && (
          <Card className="p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#EBF3FF" }}>
              <User size={20} style={{ color: BLUE }} />
            </div>
            <p className="text-sm font-bold text-gray-800">Sign in required</p>
            <p className="text-xs text-gray-400 mt-1">Profile data is linked to one participant account. Please login or register first.</p>
            <button onClick={() => nav("login")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Go to login</button>
          </Card>
        )}

        {!loading && !needsLogin && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">Profile could not load</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={loadProfile} className="text-xs font-bold mt-2" style={{ color: RED }}>Retry</button>
          </div>
        )}

        {!loading && !needsLogin && missingProfile && !error && (
          <Card className="p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#FFF7ED" }}>
              <FileText size={20} style={{ color: ORANGE }} />
            </div>
            <p className="text-sm font-bold text-gray-800">Profile not completed</p>
            <p className="text-xs text-gray-400 mt-1">Add your demographic, lifestyle, and medical information once. It will be stored in MongoDB.</p>
            <button onClick={() => nav("participant-profile")} className="mt-3 text-xs font-bold" style={{ color: BLUE }}>Complete profile</button>
          </Card>
        )}

        {!loading && !needsLogin && !error && profile && (
          <>
            <SectionCard title="Personal Information">
              <FormRow label="Age"          value={String(profile.age)} editable={false} />
              <FormRow label="Gender"       value={profile.gender} editable={false} />
              <FormRow label="Height"       value={`${profile.height_cm} cm`} editable={false} />
              <FormRow label="Weight"       value={`${profile.weight_kg} kg`} editable={false} />
              <FormRow label="BMI"          value={`${profile.bmi} - ${bmiCategory(profile.bmi).label}`} editable={false} />
              <FormRow label="Email"        value={participant?.email ?? "-"} editable={false} />
              <FormRow label="Education"    value={profile.education} editable={false} />
              <FormRow label="Occupation"   value={profile.occupation} editable={false} />
            </SectionCard>
            <SectionCard title="Lifestyle">
              <FormRow label="Smoking"      value={profile.smoking} editable={false} />
              <FormRow label="Alcohol"      value={profile.alcohol} editable={false} />
              <FormRow label="Sleep"        value={`${profile.sleep_hours} hrs/day`} editable={false} />
              <FormRow label="Exercise"     value={`${profile.exercise_days_per_week} days/week`} editable={false} />
            </SectionCard>
            <SectionCard title="Medical History">
              <FormRow label="Heart Disease" value={boolText(profile.heart_disease)} editable={false} />
              <FormRow label="Hypertension"  value={boolText(profile.hypertension)} editable={false} />
              <FormRow label="Diabetes"      value={boolText(profile.diabetes)} editable={false} />
              <FormRow label="Medication"    value={profile.medication || "None"} editable={false} />
            </SectionCard>
            <SectionCard title="Backend Record">
              <FormRow label="Participant" value={participant?.participant_code ?? "-"} editable={false} />
              <FormRow label="Updated" value={formatBackendDateTime(profile.updated_at)} editable={false} />
            </SectionCard>
          </>
        )}

        {!needsLogin && <Btn onClick={() => nav("participant-profile")} variant="outline" color={BLUE}>{profile ? "Edit Profile" : "Complete Profile"}</Btn>}
        <Btn onClick={logout} color={RED}>Logout</Btn>
        <div className="h-4" />
      </ScrollArea>
      <BottomTabs active="profile-view" nav={nav} />
    </div>
  )
}
// SCREEN 20 â€” Staff Login
function StaffLoginScreen({ nav, onLogin }: { nav: Nav; onLogin: (r: "participant"|"researcher"|"doctor") => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const signIn = async () => {
    if (busy) return
    setError("")
    setMessage("")
    if (!email.trim() || !password) { setError("Email and password are required"); return }
    setBusy(true)
    try {
      const user = await api.login(email.trim().toLowerCase(), password)
      if (!user?.role) throw new Error("Login response was invalid. Please try again.")
      if (user.role === "super_admin") {
        throw new Error("Super admin access is only available on the web dashboard.")
      }
      if (user.role !== "researcher" && user.role !== "doctor") {
        throw new Error("This account is not authorized for staff access")
      }
      onLogin(user.role === "doctor" ? "doctor" : "researcher")
      nav("researcher-dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff login failed")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col h-full" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #0D2B5C 100%)` }}>
      <NavBar title="Staff Sign In" onBack={() => nav("splash")} />
      <ScrollArea className="px-4 py-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg" style={{ backgroundColor: "rgba(29,104,240,0.3)", border: "1.5px solid rgba(29,104,240,0.5)" }}>
            <Stethoscope size={30} className="text-blue-300" />
          </div>
          <h2 className="text-xl font-bold text-white">Researcher / Doctor Sign In</h2>
          <p className="text-blue-200 text-sm text-center mt-1.5 leading-relaxed">Authorized research personnel only.</p>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-blue-200 text-sm font-medium block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="researcher@university.edu" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-blue-200 text-sm font-medium block mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>
        {error && <p className="text-xs text-red-100 bg-red-500/20 border border-red-300/20 rounded-xl p-2 mb-3">{error}</p>}
        {message && <p className="text-xs text-blue-100 bg-blue-500/20 border border-blue-300/20 rounded-xl p-2 mb-3">{message}</p>}
        <Btn onClick={signIn} color={busy ? "#6B7280" : BLUE}>{busy ? "Signing in..." : "Sign In"}</Btn>
        <Btn onClick={() => nav("splash")} variant="ghost" color="rgba(255,255,255,0.6)"><span className="text-white/60">Back to participant app</span></Btn>
        <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-blue-200 text-xs text-center">All access is logged and monitored. Unauthorised access is prohibited.</p>
        </div>
      </ScrollArea>
    </div>
  )
}

// SCREEN 21 â€” Researcher Dashboard
function ResearcherDashboardScreen({ nav }: { nav: Nav }) {
  const [summary, setSummary] = useState({ participants: 0, sessions: 0, completed: 0, pending: 0, quality: [{ name: "Good", value: 0 }, { name: "Moderate", value: 0 }, { name: "Poor", value: 0 }] })
  const [sessions, setSessions] = useState<MobileSession[]>([])
  const [error, setError] = useState("")
  useEffect(() => {
    api.getResearchData().then(data => {
      setSummary(data.summary)
      setSessions(data.sessions)
      setError("")
    }).catch(err => setError(err instanceof Error ? err.message : "Could not load data"))
  }, [])
  const pieData = summary.quality
  const COLORS = [GREEN, ORANGE, RED]
  const logout = () => {
    api.logout()
    nav("splash")
  }
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Researcher Dashboard"
        right={<button onClick={logout} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white"><LogOut size={14} />Logout</button>} />
      <ScrollArea className="px-4 py-4 space-y-3">
        {/* KPI grid */}
        {(() => {
          const kpis = [
            { v: String(summary.participants), l: "Participants",    c: BLUE,   KIcon: Users        },
            { v: String(summary.sessions), l: "Total Sessions",  c: TEAL,   KIcon: Activity     },
            { v: String(summary.completed), l: "Completed",       c: GREEN,  KIcon: CheckCircle  },
            { v: String(summary.pending), l: "Pending",         c: ORANGE, KIcon: AlertCircle  },
          ]
          return (
            <div className="grid grid-cols-2 gap-2">
              {kpis.map(({ v, l, c, KIcon }) => (
                <Card key={l} className="p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c}20` }}>
                    <KIcon size={16} style={{ color: c }} />
                  </div>
                  <div>
                    <p className="text-2xl font-black" style={{ color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</p>
                    <p className="text-xs text-gray-400">{l}</p>
                  </div>
                </Card>
              ))}
            </div>
          )
        })()}

        {/* Donut chart */}
        <Card className="p-4">
          <p className="text-sm font-bold text-gray-800 mb-2">Data Quality Overview</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={pieData} cx={45} cy={45} innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-gray-600 flex-1">{d.name}</span>
                  <span className="text-sm font-bold" style={{ color: COLORS[i] }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent sessions */}
        <SectionCard title="Recent Sessions">
          {error && <p className="py-3 text-xs font-semibold text-red-600">{error}</p>}
          {!error && sessions.length === 0 && <p className="py-3 text-xs text-gray-400">No sessions</p>}
          {sessions.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-bold text-gray-800">{s.pid} â€” {s.cond}</p>
                <p className="text-xs text-gray-400">{s.date}</p>
              </div>
              <div className="ml-auto"><StatusBadge status={s.quality} /></div>
            </div>
          ))}
        </SectionCard>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Sensor Quality", screen: "sensor-quality" as Screen, icon: Activity, color: TEAL  },
            { label: "Doctor Review",  screen: "doctor-assessment" as Screen, icon: Stethoscope, color: BLUE  },
            { label: "Data Features",  screen: "data-overview" as Screen, icon: Database, color: "#7C3AED" },
            { label: "Export Data",    screen: "export" as Screen, icon: Download, color: ORANGE },
          ].map(({ label, screen, icon: Icon, color }) => (
            <button key={label} onClick={() => nav(screen)} className="p-3.5 rounded-xl border border-gray-100 bg-white flex items-center gap-2 shadow-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
      <ResearcherTabs active="researcher-dashboard" nav={nav} />
    </div>
  )
}

// SCREEN 22 â€” Researcher Participants
function ResearcherParticipantsScreen({ nav }: { nav: Nav }) {
  const [query, setQuery] = useState("")
  const [participants, setParticipants] = useState<MobileParticipant[]>([])
  useEffect(() => {
    api.getResearchData().then(data => setParticipants(data.participants)).catch(() => setParticipants([]))
  }, [])
  const filtered = participants.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query))
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Participants" right={<span className="text-blue-200 text-sm font-bold">{participants.length} total</span>} />
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none shadow-sm" />
        </div>
      </div>
      <ScrollArea className="px-4 pb-4 space-y-2">
        {filtered.length === 0 && (
          <Card className="p-4 text-center text-xs text-gray-400">
            No participants found in MongoDB.
          </Card>
        )}
        {filtered.map(p => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: p.consent ? BLUE : "#9CA3AF" }}>
                {p.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-gray-900">{p.name}</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ fontFamily: "'JetBrains Mono', monospace", backgroundColor: "#F1F5F9", color: "#64748B" }}>{p.id}</span>
                </div>
                <p className="text-xs text-gray-400">{p.gender === "F" ? "Female" : "Male"}, {p.age} yrs Â· Last: {p.last}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={p.consent ? "Accepted" : "Pending"} />
                  <span className="text-xs text-gray-400">{p.sessions} session{p.sessions !== 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <div className="w-16 h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.pct > 70 ? GREEN : p.pct > 40 ? ORANGE : RED }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: p.pct > 70 ? GREEN : p.pct > 40 ? ORANGE : RED }}>{p.pct}%</span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => nav("doctor-assessment")} className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: `${BLUE}40`, color: BLUE }}>
              View Detail
            </button>
          </Card>
        ))}
      </ScrollArea>
      <ResearcherTabs active="researcher-participants" nav={nav} />
    </div>
  )
}

// SCREEN 23 â€” Researcher Sessions
function ResearcherSessionsScreen({ nav }: { nav: Nav }) {
  const [filter, setFilter] = useState("All")
  const [sessions, setSessions] = useState<MobileSession[]>([])
  useEffect(() => {
    api.getResearchData().then(data => setSessions(data.sessions)).catch(() => setSessions([]))
  }, [])
  const filters = ["All", "Relaxed", "Stress", "Complete", "Missing"]
  const filtered = sessions.filter(s => {
    if (filter === "All")      return true
    if (filter === "Relaxed")  return s.cond === "Relaxed"
    if (filter === "Stress")   return s.cond === "Stress"
    if (filter === "Complete") return s.q
    if (filter === "Missing")  return !s.q || !s.eda
    return true
  })
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Sessions" right={<span className="text-blue-200 text-sm font-bold">{sessions.length}</span>} />
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: filter === f ? BLUE : "white", color: filter === f ? "white" : "#64748B", border: filter === f ? "none" : "1px solid #E2E8F0" }}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="px-4 pb-4 space-y-2">
        {filtered.length === 0 && (
          <Card className="p-4 text-center text-xs text-gray-400">
            No sessions found in MongoDB.
          </Card>
        )}
        {filtered.map(s => {
          const isRelaxed = s.cond === "Relaxed"
          const color = isRelaxed ? GREEN : ORANGE
          const dataFields: [string, boolean][] = [["ECG", s.ecg], ["HRV", s.hrv], ["EDA", s.eda], ["Temp", s.temp], ["Q", s.q]]
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>{s.cond}</span>
                    <span className="text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#64748B" }}>{s.id}</span>
                    <span className="text-xs text-gray-400">Â· {s.pid}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{s.pname} Â· {s.date}</p>
                </div>
                <StatusBadge status={s.quality} />
              </div>
              <div className="flex gap-1 flex-wrap mb-2">
                {dataFields.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: v ? "#F0FDF4" : "#FEF2F2", color: v ? GREEN : RED }}>
                    {k} {v ? "âœ“" : "âœ—"}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Stethoscope size={12} className="text-gray-400" />
                  <StatusBadge status={s.doctor} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { api.useSession(s.rawId, s.id); nav("sensor-quality") }} className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: TEAL, backgroundColor: "#F0FDFA" }}>Quality</button>
                  <button onClick={() => { api.useSession(s.rawId, s.id); nav("doctor-assessment") }} className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: BLUE, backgroundColor: "#EBF3FF" }}>Assess</button>
                </div>
              </div>
            </Card>
          )
        })}
      </ScrollArea>
      <ResearcherTabs active="researcher-sessions" nav={nav} />
    </div>
  )
}

// SCREEN 24 â€” Sensor Quality
function SensorQualityScreen({ nav }: { nav: Nav }) {
  const iconMap: Record<string, React.ComponentType<{ size: number; style?: React.CSSProperties }>> = {
    ECG: Activity,
    "HRV (RMSSD)": TrendingUp,
    EDA: Zap,
    Temperature: Thermometer,
    Respiration: Database,
    Accelerometer: Activity,
    Battery: Battery,
  }
  const [sensors, setSensors] = useState<Array<{ name: string; quality: string; score: number; icon: React.ComponentType<{ size: number; style?: React.CSSProperties }> }>>([])
  const [error, setError] = useState("")
  useEffect(() => {
    api.getPhysiologicalQuality().then(rows => {
      setSensors(rows.map(row => ({ ...row, icon: iconMap[row.name] || Activity })))
      setError("")
    }).catch(err => setError(err instanceof Error ? err.message : "Could not load sensor quality"))
  }, [])
  const qColors: Record<string, string> = { Good: GREEN, Moderate: ORANGE, Poor: RED, Missing: "#9CA3AF" }
  const sessionCode = api.activeSessionCode ?? "Selected session"
  const availableScores = sensors.filter(sensor => sensor.quality !== "Missing")
  const overallScore = availableScores.length
    ? Math.round(availableScores.reduce((total, sensor) => total + sensor.score, 0) / availableScores.length)
    : 0
  const overallStatus = overallScore >= 80 ? "Good" : overallScore >= 50 ? "Moderate" : overallScore > 0 ? "Poor" : "Missing"
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Sensor Quality" subtitle={sessionCode} onBack={() => nav("researcher-sessions")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        {/* Overall */}
        <Card className="p-4 flex items-center gap-4">
          {overallScore > 0 && (
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallScore / 100)}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black" style={{ color: TEAL }}>{overallScore}</span>
                <span className="text-[9px] text-gray-400">/ 100</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-800">Overall Quality</p>
            <StatusBadge status={overallStatus} />
            <p className="text-xs text-gray-400 mt-1.5">
              {overallScore > 0 ? "Calculated from latest MongoDB sensor records." : "No sensor records available."}
            </p>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </Card>

        {/* Per-sensor */}
        <SectionCard title="Sensor Breakdown">
          {sensors.length === 0 && <p className="py-3 text-xs text-gray-400">No physiological records found.</p>}
          {sensors.map(({ name, quality, score, icon: Icon }) => (
            <div key={name} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${qColors[quality]}20` }}>
                <Icon size={14} style={{ color: qColors[quality] }} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-700">{name}</span>
                  <StatusBadge status={quality} />
                </div>
                {quality !== "Missing" ? (
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{ width: `${score}%`, backgroundColor: qColors[quality] }} />
                  </div>
                ) : (
                  <p className="text-xs text-red-500 font-medium">No data recorded</p>
                )}
              </div>
            </div>
          ))}
        </SectionCard>

        <Card className="p-3 flex items-start gap-2 border-orange-100" style={{ backgroundColor: "#FFF7ED" }}>
          <AlertCircle size={14} style={{ color: ORANGE, flexShrink: 0, marginTop: 1 }} />
        </Card>
        <Btn onClick={() => nav("doctor-assessment")} color={BLUE}>Proceed to Assessment</Btn>
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 25 â€” Doctor Assessment
function DoctorAssessmentScreen({ nav }: { nav: Nav }) {
  const [label, setLabel] = useState("")
  const [comment, setComment] = useState("")
  const [saved, setSaved] = useState(false)
  const sessionCode = api.activeSessionCode ?? "Selected session"
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Doctor Assessment" subtitle={sessionCode} onBack={() => nav("researcher-sessions")} />
      <ScrollArea className="px-4 py-4 space-y-3">
        {/* Patient summary */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={20} style={{ color: BLUE }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{sessionCode}</p>
              <p className="text-xs text-gray-400">Research session selected from backend</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-GB")}</p>
            </div>
          </div>
        </Card>

        {/* Clinical label */}
        <SectionCard title="Clinical Stress Label">
          <div className="py-2 space-y-2">
            {["Low", "Moderate", "High", "Severe"].map(l => (
              <button key={l} onClick={() => setLabel(l)} className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 text-sm font-semibold transition-all ${label === l ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50"}`}>
                <div className={`w-4 h-4 rounded-full border-2 ${label === l ? "border-blue-500" : "border-gray-300"}`}>
                  {label === l && <div className="w-2 h-2 rounded-full m-0.5" style={{ backgroundColor: BLUE }} />}
                </div>
                <span style={{ color: l === "Low" ? GREEN : l === "Moderate" ? ORANGE : RED }}>{l}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <Card className="p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Clinical Comments</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Enter clinical observations..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm text-gray-700 focus:outline-none h-20 resize-none" />
          </div>
          <FieldInput label="Recommendation" placeholder="e.g. Follow-up in 2 weeks" />
        </Card>

        {saved ? (
          <div className="p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: "#DCFCE7" }}>
            <CheckCircle size={20} style={{ color: GREEN }} />
            <p className="text-sm font-semibold text-green-800">Assessment saved successfully.</p>
          </div>
        ) : (
          <Btn onClick={async () => { if (label) { await api.saveDoctorAssessment(label as "Low" | "Moderate" | "High" | "Severe", comment); setSaved(true) } }} color={label ? BLUE : "#9CA3AF"}>Save Assessment</Btn>
        )}
        <div className="h-2" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 26 â€” Export
function ExportScreen({ nav }: { nav: Nav }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [condition, setCondition] = useState<"combined" | "relaxed" | "stress">("combined")
  const items = [
    { key: "participant",    label: "Participant Information",  type: "CSV" },
    { key: "physiological",  label: "Physiological Data",       type: "CSV" },
    { key: "questionnaire",  label: "Questionnaire Data",       type: "CSV" },
    { key: "doctor",         label: "Doctor Assessment",        type: "CSV" },
    { key: "all",            label: "All Data (Recommended)",   type: "ZIP", highlight: true },
  ]
  const toggle = (k: string) => setChecked(c => ({ ...c, [k]: !c[k] }))
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Export Data" onBack={() => nav("researcher-dashboard")} />
      <ScrollArea className="px-4 py-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Select data to export</h2>
          <p className="text-sm text-gray-500 mt-0.5">Choose the datasets you want to download.</p>
        </div>

        {/* Date range */}
        <Card className="p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Condition</p>
          <select value={condition} onChange={e => setCondition(e.target.value as typeof condition)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm font-medium text-gray-700">
            <option value="combined">Combined</option>
            <option value="relaxed">Relaxed only</option>
            <option value="stress">Stress only</option>
          </select>
        </Card>

        {/* Export items */}
        <Card className="divide-y divide-gray-50">
          {items.map(({ key, label, type, highlight }) => (
            <button key={key} onClick={() => toggle(key)} className={`w-full flex items-center gap-3 p-3.5 text-left ${highlight ? "bg-blue-50/50" : ""}`}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked[key] ? "" : ""}`}
                style={{ borderColor: checked[key] ? BLUE : "#D1D5DB", backgroundColor: checked[key] ? BLUE : "white" }}>
                {checked[key] && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                {highlight && <p className="text-xs text-blue-500">Includes all data types</p>}
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: type === "ZIP" ? "#FFF7ED" : "#F0F9FF", color: type === "ZIP" ? ORANGE : BLUE }}>{type}</span>
            </button>
          ))}
        </Card>

        <Btn onClick={async () => {
          if (checked.all) await api.downloadExport("final_dataset.csv", condition)
          else {
            const selected = Object.entries(checked).filter(([, value]) => value).map(([key]) => `${key}.csv`)
            for (const filename of selected) await api.downloadExport(filename, condition)
          }
        }} color={Object.values(checked).some(Boolean) ? BLUE : "#9CA3AF"}>
          <span className="flex items-center justify-center gap-2"><Download size={16} />Export Selected</span>
        </Btn>
        <button onClick={() => nav("export-history")} className="w-full py-2 text-sm font-semibold text-center" style={{ color: BLUE }}>View Export History</button>
        <div className="h-2" />
      </ScrollArea>
      <ResearcherTabs active="export" nav={nav} />
    </div>
  )
}

// SCREEN 27 â€” Export History
function ExportHistoryScreen({ nav }: { nav: Nav }) {
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Export History" onBack={() => nav("export")} />
      <ScrollArea className="px-4 py-4 space-y-2">
        <p className="text-xs text-gray-400 font-medium">Previously exported files</p>
        <Card className="p-4 text-center text-xs text-gray-400">
          No export history is stored in the frontend.
        </Card>
        <Card className="p-3 flex items-center gap-2" style={{ backgroundColor: "#F0FDF4", borderColor: "#BBFBD0" }}>
          <CheckCircle size={14} style={{ color: GREEN }} />
          <p className="text-xs text-green-700 font-medium">All exports are encrypted and access-logged.</p>
        </Card>
        <div className="h-4" />
      </ScrollArea>
    </div>
  )
}

// SCREEN 28 â€” Data Feature Overview
function DataOverviewScreen({ nav }: { nav: Nav }) {
  const [sessions, setSessions] = useState<MobileSession[]>([])
  const [error, setError] = useState("")
  useEffect(() => {
    api.getResearchData()
      .then(data => {
        setSessions(data.sessions)
        setError("")
      })
      .catch(err => setError(err instanceof Error ? err.message : "Could not load data overview"))
  }, [])
  const features = [
    { icon: Activity,   label: "Physiological Signals", desc: "ECG, HR, HRV, EDA, Temp, Respiration",             color: RED    },
        { icon: FileText,   label: "Questionnaire",          desc: "Collect self-reported stress labels",               color: BLUE   },
    { icon: Stethoscope,label: "Doctor Assessment",      desc: "Clinical evaluation and stress labeling",           color: "#7C3AED" },
    { icon: Database,   label: "Secure Storage",         desc: "Encrypted MongoDB backend with audit logs",         color: GREEN  },
    { icon: Zap,        label: "Research Ready",         desc: "Export datasets for AI/ML research",                color: ORANGE },
  ]
  return (
    <div className="flex flex-col h-full bg-[#F0F4F8]">
      <NavBar title="Data Overview" onBack={() => nav("researcher-dashboard")} />
      <ScrollArea className="px-4 py-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Data Feature Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">All modalities collected per session.</p>
        </div>

        <div className="space-y-2">
          {features.map(({ icon: Icon, label, desc, color }) => (
            <Card key={label} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            </Card>
          ))}
        </div>

        {/* Data completeness table */}
        <Card className="overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Data Completeness Matrix</p>
          </div>
          <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold w-16">P-ID</th>
                  <th className="text-left py-2 px-1.5 text-gray-400 font-semibold w-10">Sess</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">Cond</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">ECG</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">HRV</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">EDA</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">Tmp</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">Aud</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">Q</th>
                  <th className="py-2 px-1 text-gray-400 font-semibold">Dr</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-4 px-3 text-center text-gray-400">
                      {error || "No MongoDB sessions available."}
                    </td>
                  </tr>
                )}
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-3 font-bold text-gray-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.pid}</td>
                    <td className="py-2 px-1.5 text-gray-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.id}</td>
                    <td className="py-2 px-1 text-center">
                      <span className="text-[10px] font-bold px-1 rounded" style={{ backgroundColor: s.cond === "Relaxed" ? "#DCFCE7" : "#FEE2E2", color: s.cond === "Relaxed" ? GREEN : RED }}>{s.cond === "Relaxed" ? "R" : "S"}</span>
                    </td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.ecg}   /></td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.hrv}   /></td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.eda}   /></td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.temp}  /></td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.q}     /></td>
                    <td className="py-2 px-1 text-center"><DataBit ok={s.doctor === "Completed" ? true : null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex gap-4 px-1 text-xs text-gray-400 font-medium">
          <span className="flex items-center gap-1"><span className="font-bold text-green-600">âœ“</span> Collected</span>
          <span className="flex items-center gap-1"><span className="font-bold text-red-500">âœ—</span> Missing</span>
          <span className="flex items-center gap-1"><span className="font-bold text-orange-500">Pend</span> Awaiting</span>
        </div>
        <div className="h-4" />
      </ScrollArea>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const ALL_SCREENS: { id: Screen; label: string }[] = [
  { id: "splash",                  label: "1. Splash"              },
  { id: "register",                label: "2. Register"            },
  { id: "login",                   label: "3. Login"               },
  { id: "consent",                 label: "5. Consent"             },
  { id: "participant-profile",     label: "6. Profile Form"        },
  { id: "select-session",          label: "7. Home"                },
  { id: "relaxed-instructions",    label: "8. Relax Instr."        },
  { id: "relaxed-recording",       label: "9. Relax Rec."          },
  { id: "stress-task-select",      label: "10. Task Select"        },
  { id: "stress-task",             label: "11. Stress Task"        },
  { id: "stress-recording",        label: "12. Stress Rec."        },
  { id: "audio-recording",         label: "13. Audio Rec."         },
  { id: "questionnaire",           label: "14. Questionnaire"      },
  { id: "questionnaire-complete",  label: "15. Q Complete"         },
  { id: "session-summary",         label: "16. Summary"            },
  { id: "history",                 label: "17. History"            },
  { id: "participant-dashboard",   label: "18. P Dashboard"        },
  { id: "profile-view",            label: "19. Profile View"       },
  { id: "staff-login",             label: "20. Staff Login"        },
  { id: "researcher-dashboard",    label: "21. R Dashboard"        },
  { id: "researcher-participants", label: "22. Participants"        },
  { id: "researcher-sessions",     label: "23. Sessions"           },
  { id: "sensor-quality",          label: "24. Sensor Quality"     },
  { id: "doctor-assessment",       label: "25. Dr Assessment"      },
  { id: "export",                  label: "26. Export"             },
  { id: "export-history",          label: "27. Export History"     },
  { id: "data-overview",           label: "28. Data Overview"      },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem("stresssense_screen") as Screen | null
    if (saved && ALL_SCREENS.some(item => item.id === saved)) return saved
    return "splash"
  })
  const [sessionType, setSessionType] = useState<SessionType>("relaxed")
  const [stressTask, setStressTask] = useState(0)
  const [role, setRole] = useState<"participant"|"researcher"|"doctor">("participant")
  const [navOpen, setNavOpen] = useState(false)
  const [statusTime, setStatusTime] = useState(currentTime())

  useEffect(() => {
    const timer = window.setInterval(() => setStatusTime(currentTime()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    if (!api.isSignedIn()) return
    api.me().then(user => {
      if (!active) return
      if (user.role === "super_admin") {
        api.logout()
        nav("splash")
        return
      }
      setRole(user.role === "doctor" ? "doctor" : user.role === "researcher" ? "researcher" : "participant")
      if (screen === "splash" || screen === "login" || screen === "register") {
        nav(user.role === "researcher" || user.role === "doctor" ? "researcher-dashboard" : user.next_step === "profile" ? "participant-profile" : user.next_step === "dashboard" ? "select-session" : "consent")
      }
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const nav: Nav = (s, opts) => {
    if (opts?.sessionType) setSessionType(opts.sessionType)
    if (opts?.task !== undefined) setStressTask(opts.task)
    setScreen(s)
    localStorage.setItem("stresssense_screen", s)
    setNavOpen(false)
  }

  const idx = ALL_SCREENS.findIndex(s => s.id === screen)

  const renderScreen = () => {
    switch (screen) {
      case "splash":                  return <SplashScreen nav={nav} />
      case "register":                return <RegisterScreen nav={nav} />
      case "login":                   return <LoginScreen nav={nav} onLogin={setRole} />
      case "consent":                 return <ConsentScreen nav={nav} />
      case "participant-profile":     return <ParticipantProfileScreen nav={nav} />
      case "select-session":          return <SelectSessionScreen nav={nav} />
      case "relaxed-instructions":    return <RelaxedInstructionsScreen nav={nav} />
      case "relaxed-recording":       return <RelaxedRecordingScreen nav={nav} />
      case "stress-task-select":      return <StressTaskSelectScreen nav={nav} />
      case "stress-task":             return <StressTaskScreen nav={nav} task={stressTask} />
      case "stress-recording":        return <StressRecordingScreen nav={nav} />
      case "audio-recording":         return <AudioRecordingScreen nav={nav} sessionType={sessionType} />
      case "questionnaire":           return <QuestionnaireScreen nav={nav} />
      case "questionnaire-complete":  return <QuestionnaireCompleteScreen nav={nav} />
      case "session-summary":         return <SessionSummaryScreen nav={nav} sessionType={sessionType} />
      case "history":                 return <HistoryScreen nav={nav} />
      case "participant-dashboard":   return <ParticipantDashboardScreen nav={nav} />
      case "profile-view":            return <ProfileViewScreen nav={nav} />
      case "staff-login":             return <StaffLoginScreen nav={nav} onLogin={setRole} />
      case "researcher-dashboard":    return <ResearcherDashboardScreen nav={nav} />
      case "researcher-participants": return <ResearcherParticipantsScreen nav={nav} />
      case "researcher-sessions":     return <ResearcherSessionsScreen nav={nav} />
      case "sensor-quality":          return <SensorQualityScreen nav={nav} />
      case "doctor-assessment":       return <DoctorAssessmentScreen nav={nav} />
      case "export":                  return <ExportScreen nav={nav} />
      case "export-history":          return <ExportHistoryScreen nav={nav} />
      case "data-overview":           return <DataOverviewScreen nav={nav} />
      default:                        return <SplashScreen nav={nav} />
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0B1E3D 0%, #1a3a6b 50%, #0B1E3D 100%)", fontFamily: "'Inter', sans-serif" }}>
      {/* Left sidebar nav for prototyping */}
      <div className="hidden" style={{ scrollbarWidth: "none" }}>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">All Screens</p>
        {ALL_SCREENS.map(s => (
          <button key={s.id} onClick={() => nav(s.id)}
            className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${screen === s.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Center: phone frame */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
        {/* Frame */}
        <div className="relative flex flex-col overflow-hidden"
          style={{ width: 390, height: 844, borderRadius: 44, boxShadow: "0 0 0 1.5px rgba(255,255,255,0.15), 0 50px 100px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)", background: "#EEF2F7" }}>
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50" style={{ width: 120, height: 32, backgroundColor: "#000", borderRadius: "0 0 20px 20px" }} />
          {/* Status bar */}
          <div className="h-11 flex items-end justify-between px-7 pb-1 flex-shrink-0 relative z-10" style={{ backgroundColor: screen === "splash" || screen === "staff-login" ? NAVY : "transparent" }}>
            <span className="text-[12px] font-bold" style={{ color: screen === "splash" || screen === "staff-login" ? "white" : "#0B1E3D" }}>{statusTime}</span>
            <div className="flex items-center gap-1.5">
              {[3, 5, 7].map(h => <div key={h} className="rounded-sm" style={{ width: 3, height: h, backgroundColor: screen === "splash" || screen === "staff-login" ? "white" : "#0B1E3D", opacity: 0.8 }} />)}
              <div className="w-4 h-2.5 rounded-sm border" style={{ borderColor: screen === "splash" || screen === "staff-login" ? "white" : "#0B1E3D" }}>
                <div className="h-full rounded-sm" style={{ width: "70%", backgroundColor: screen === "splash" || screen === "staff-login" ? "white" : "#0B1E3D" }} />
              </div>
            </div>
          </div>
          {/* Screen content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {renderScreen()}
          </div>
          {/* Home indicator */}
          <div className="flex justify-center pb-2 flex-shrink-0" style={{ backgroundColor: screen === "splash" || screen === "staff-login" ? "#071A36" : "#EEF2F7" }}>
            <div className="w-28 h-1 rounded-full" style={{ backgroundColor: screen === "splash" || screen === "staff-login" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)" }} />
          </div>
        </div>

        {/* Bottom screen navigator */}
        <div className="hidden">
          <button onClick={() => nav(ALL_SCREENS[Math.max(0, idx - 1)].id)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            disabled={idx === 0}>
            â€¹
          </button>
          <div className="text-center">
            <p className="text-white text-sm font-semibold">{ALL_SCREENS[idx]?.label}</p>
            <p className="text-white/40 text-xs">{idx + 1} of {ALL_SCREENS.length}</p>
          </div>
          <button onClick={() => nav(ALL_SCREENS[Math.min(ALL_SCREENS.length - 1, idx + 1)].id)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            disabled={idx === ALL_SCREENS.length - 1}>
            â€º
          </button>
        </div>

        {/* Mobile nav toggle */}
        <button onClick={() => setNavOpen(!navOpen)}
          className="hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          {navOpen ? <X size={16} className="text-white" /> : <Menu size={16} className="text-white" />}
        </button>
        {navOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: "rgba(11,30,61,0.97)" }}>
            <div className="flex justify-between items-center px-5 pt-12 pb-4">
              <p className="text-white font-bold">All Screens</p>
              <button onClick={() => setNavOpen(false)}><X size={20} className="text-white" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-8 grid grid-cols-2 gap-2 content-start">
              {ALL_SCREENS.map(s => (
                <button key={s.id} onClick={() => nav(s.id)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium ${screen === s.id ? "bg-white/20 text-white" : "text-white/60"}`}
                  style={{ backgroundColor: screen === s.id ? "rgba(29,104,240,0.3)" : "rgba(255,255,255,0.07)" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right info panel */}
      <div className="hidden">
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">App Info</p>
          <div className="space-y-2 text-xs text-white/50">
            <p><span className="text-white/70 font-semibold">App:</span> StressSense</p>
            <p><span className="text-white/70 font-semibold">Role:</span> {role}</p>
            <p><span className="text-white/70 font-semibold">Session:</span> {sessionType}</p>
            <p><span className="text-white/70 font-semibold">Screens:</span> 28 / 28</p>
          </div>
        </div>
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">Quick Jump</p>
          <div className="space-y-1.5 text-xs">
            {[
              { label: "Participant Flow", screen: "splash" as Screen },
              { label: "Relax Session",   screen: "relaxed-instructions" as Screen },
              { label: "Stress Session",  screen: "stress-task-select" as Screen },
              { label: "Researcher View", screen: "staff-login" as Screen },
              { label: "Export Data",     screen: "export" as Screen },
            ].map(({ label, screen: s }) => (
              <button key={label} onClick={() => nav(s)} className="w-full text-left px-2.5 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all font-medium">{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}



