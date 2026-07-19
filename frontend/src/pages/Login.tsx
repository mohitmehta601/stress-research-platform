import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  forgotPassword,
  login,
  resetPassword,
  submitAccessRequest,
  verifyAccessRequestOtp,
} from "../services/apiClient";

type RequestedRole = "viewer" | "researcher" | "doctor";

interface AccessRequestForm {
  name: string;
  email: string;
  organization: string;
  requestedRole: RequestedRole;
  reason: string;
}

const initialRequestForm: AccessRequestForm = {
  name: "",
  email: "",
  organization: "",
  requestedRole: "viewer",
  reason: "",
};

const platformFeatures = [
  {
    icon: Activity,
    title: "Physiological monitoring",
    description: "ECG, HRV, EDA and temperature datasets",
  },
  {
    icon: ShieldCheck,
    title: "Clinical assessments",
    description: "Secure clinician-reviewed study records",
  },
  {
    icon: Database,
    title: "Research data",
    description: "Centralized longitudinal participant data",
  },
  {
    icon: FileSpreadsheet,
    title: "Structured exports",
    description: "Module-level and consolidated CSV exports",
  },
];

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const resetToken = useMemo(
    () => new URLSearchParams(window.location.search).get("resetToken"),
    [],
  );

  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestOtpToken, setRequestOtpToken] = useState("");
  const [requestOtpCode, setRequestOtpCode] = useState("");
  const [requestOtpEmail, setRequestOtpEmail] = useState("");
  const [requestOtpMessage, setRequestOtpMessage] = useState<string | null>(null);
  const [requestForm, setRequestForm] =
    useState<AccessRequestForm>(initialRequestForm);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError(null);
    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/researcher", { replace: true });
    } catch (error: unknown) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please verify your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const value = email.trim().toLowerCase();
    setLoginError(null);
    setForgotMessage(null);

    if (!value) {
      setLoginError("Enter your email address first.");
      return;
    }

    setForgotLoading(true);

    try {
      const result = await forgotPassword(value);
      setForgotMessage(result.message);
    } catch (error: unknown) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Unable to request a reset email.",
      );
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setResetMessage(null);

    if (!resetToken) return;
    if (newPassword.length < 8) {
      setLoginError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoginError("Passwords do not match.");
      return;
    }

    setResetLoading(true);

    try {
      const result = await resetPassword(resetToken, newPassword);
      setResetMessage(result.message);
      setNewPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", "/researcher/login");
    } catch (error: unknown) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Unable to reset your password.",
      );
    } finally {
      setResetLoading(false);
    }
  }

  async function handleAccessRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRequestError(null);
    setRequestLoading(true);

    try {
      const result = await submitAccessRequest({
        ...requestForm,
        name: requestForm.name.trim(),
        email: requestForm.email.trim().toLowerCase(),
        organization: requestForm.organization.trim(),
        reason: requestForm.reason.trim(),
      });

      setRequestOtpToken(result.otp_token);
      setRequestOtpEmail(result.email);
      setRequestOtpCode("");
      setRequestOtpMessage(result.message);
    } catch (error: unknown) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Unable to submit your access request. Please try again.",
      );
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleAccessRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRequestError(null);
    setRequestOtpMessage(null);

    if (requestOtpCode.trim().length !== 6) {
      setRequestError("Enter the 6-digit verification code.");
      return;
    }

    setRequestLoading(true);

    try {
      const result = await verifyAccessRequestOtp(
        requestOtpToken,
        requestOtpCode.trim(),
      );
      setRequestForm(initialRequestForm);
      setRequestOtpToken("");
      setRequestOtpCode("");
      setRequestOtpEmail("");
      setShowRequestAccess(false);
      setRequestSent(true);
      setRequestOtpMessage(result.message);
    } catch (error: unknown) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Unable to verify this code. Please try again.",
      );
    } finally {
      setRequestLoading(false);
    }
  }

  function openAccessRequest() {
    setRequestError(null);
    setRequestSent(false);
    setRequestOtpToken("");
    setRequestOtpCode("");
    setRequestOtpEmail("");
    setRequestOtpMessage(null);
    setShowRequestAccess(true);
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Brand and platform overview */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#142f59] px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-teal-950/30">
            <img
              src="/logo.png"
              alt="Stress Research Platform logo"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-white">
              Stress Research Platform
            </div>
            <div className="text-[11px] text-blue-200/70">
              Clinical research data environment
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-blue-100">
            <ShieldCheck size={14} className="text-teal-300" />
            Restricted institutional access
          </div>

          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Secure insights for longitudinal stress research.
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100/70 xl:text-base">
            Review participant activity, physiological measurements,
            questionnaire responses and clinician assessments through one
            secure research dashboard.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {platformFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <Icon size={17} className="text-teal-300" />
                  </div>

                  <div className="text-sm font-medium text-white">
                    {feature.title}
                  </div>

                  <div className="mt-1 text-xs leading-5 text-blue-100/60">
                    {feature.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-blue-100/50">
          <span>Protected research environment</span>
          <span>Authorized personnel only</span>
        </div>
      </section>

      {/* Authentication panel */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <img
                src="/logo.png"
                alt="Stress Research Platform logo"
                className="h-full w-full object-cover"
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">
                Stress Research Platform
              </div>
              <div className="text-xs text-slate-500">
                Research administration portal
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.28)] sm:p-9">
            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3fb]">
                <LockKeyhole size={22} className="text-[#173764]" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {resetToken ? "Set new password" : "Welcome back"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {resetToken
                  ? "Choose a new password for your approved account."
                  : "Sign in using your approved institutional account."}
              </p>
            </div>

            {requestSent && (
              <div
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
              >
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
                <div>
                  <div className="font-medium">Request submitted</div>
                  <div className="mt-0.5 text-xs leading-5 text-emerald-700">
                    Your request has been sent for administrator review.
                  </div>
                </div>
              </div>
            )}

            {loginError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-red-600"
                />
                <span className="leading-5">{loginError}</span>
              </div>
            )}

            {forgotMessage && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm leading-5 text-blue-800"
              >
                {forgotMessage}
              </div>
            )}

            {resetMessage && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-5 text-emerald-800"
              >
                {resetMessage} You can now sign in.
              </div>
            )}

            {resetToken ? (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-xs font-semibold text-slate-700"
                  >
                    New password
                  </label>

                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#315d95] focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-xs font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#315d95] focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173764] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d457d] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Updating
                    </>
                  ) : (
                    "Update password"
                  )}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold text-slate-700"
                >
                  Institutional email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@institution.edu"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#315d95] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#315d95] focus:ring-4 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="mt-2 text-xs font-semibold text-[#315d95] transition hover:text-[#173764] disabled:opacity-60"
                >
                  {forgotLoading ? "Sending reset email..." : "Forgot password?"}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173764] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d457d] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Authenticating
                  </>
                ) : (
                  <>
                    Sign in securely
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
            )}

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Access required
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={openAccessRequest}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <UserRoundPlus size={17} />
              Request dashboard access
            </button>

            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck size={13} />
              Access is logged and subject to administrator approval
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            This system contains restricted research information. Unauthorized
            access or distribution is prohibited.
          </p>
        </div>
      </main>

      {/* Access request modal */}
      {showRequestAccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-request-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
                  <UserRoundPlus size={20} className="text-teal-700" />
                </div>

                <h3
                  id="access-request-title"
                  className="text-xl font-semibold text-slate-950"
                >
                  {requestOtpToken
                    ? "Verify work email"
                    : "Request dashboard access"}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {requestOtpToken
                    ? `Enter the 6-digit code sent to ${requestOtpEmail}.`
                    : "Submit your institutional details for super-admin review."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRequestAccess(false)}
                aria-label="Close access request"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={19} />
              </button>
            </div>

            {requestError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-red-600"
                />
                <span>{requestError}</span>
              </div>
            )}

            {requestOtpMessage && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm leading-5 text-blue-800">
                {requestOtpMessage}
              </div>
            )}

            {requestOtpToken ? (
              <form onSubmit={handleAccessRequestOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="request-otp"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Verification code
                  </label>

                  <input
                    id="request-otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={requestOtpCode}
                    onChange={(event) =>
                      setRequestOtpCode(
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                    placeholder="000000"
                    className="h-12 w-full rounded-xl border border-slate-300 px-3.5 text-center font-mono text-xl font-semibold tracking-[0.35em] outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setRequestOtpToken("");
                      setRequestOtpCode("");
                      setRequestOtpEmail("");
                      setRequestOtpMessage(null);
                    }}
                    disabled={requestLoading}
                    className="h-11 flex-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Edit details
                  </button>

                  <button
                    type="submit"
                    disabled={requestLoading}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0b8f86] text-sm font-semibold text-white transition hover:bg-[#087c74] focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {requestLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Verifying
                      </>
                    ) : (
                      "Verify request"
                    )}
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleAccessRequest} className="space-y-4">
              <div>
                <label
                  htmlFor="request-name"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="request-name"
                  required
                  value={requestForm.name}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Your full name"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label
                  htmlFor="request-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Work email
                </label>

                <input
                  id="request-email"
                  required
                  type="email"
                  value={requestForm.email}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="name@institution.edu"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label
                  htmlFor="request-organization"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Institution or organization
                </label>

                <input
                  id="request-organization"
                  required
                  value={requestForm.organization}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      organization: event.target.value,
                    })
                  }
                  placeholder="University, hospital or laboratory"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label
                  htmlFor="request-role"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Requested role
                </label>

                <select
                  id="request-role"
                  value={requestForm.requestedRole}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      requestedRole: event.target.value as RequestedRole,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="researcher">
                    Researcher — study data management
                  </option>
                  <option value="doctor">
                    Doctor — clinical assessments
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="request-reason"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Reason for access
                </label>

                <textarea
                  id="request-reason"
                  required
                  minLength={10}
                  maxLength={500}
                  value={requestForm.reason}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      reason: event.target.value,
                    })
                  }
                  placeholder="Briefly describe why you require access to the dashboard."
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />

                <div className="mt-1 text-right text-[10px] text-slate-400">
                  {requestForm.reason.length}/500
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowRequestAccess(false)}
                  disabled={requestLoading}
                  className="h-11 flex-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={requestLoading}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0b8f86] text-sm font-semibold text-white transition hover:bg-[#087c74] focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Submitting
                    </>
                  ) : (
                    "Submit request"
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
