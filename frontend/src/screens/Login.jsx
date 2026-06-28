import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import ThemeToggle from "../components/ThemeToggle";

const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of your primary school?",
  "What is your favourite book?",
  "What was your childhood nickname?",
];

export default function Login() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const fallbackTimer = useRef(null);

  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "recover"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Security question (sign-up) + recovery flow
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [recoverStep, setRecoverStep] = useState(1); // 1 = find account, 2 = answer + new pw
  const [recoverQuestion, setRecoverQuestion] = useState("");
  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  // Client ID from build-time env (local dev) OR fetched from the backend at runtime (prod).
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  );

  const isSignup = mode === "signup";
  const isRecover = mode === "recover";

  useEffect(() => {
    api
      .authConfig()
      .then((c) => c?.google_client_id && setGoogleClientId(c.google_client_id))
      .catch(() => {});
  }, []);

  function onFormSubmit(e) {
    if (isRecover) return recoverStep === 1 ? findAccount(e) : doReset(e);
    return submit(e);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (isSignup) {
        await register(email, password, name, securityQuestion, securityAnswer);
      } else {
        await login(email, password);
      }
      navigate("/", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startRecover() {
    setMode("recover");
    setRecoverStep(1);
    setErr("");
    setInfo("");
    setRecoverAnswer("");
    setNewPassword("");
  }

  function backToSignIn() {
    setMode("signin");
    setRecoverStep(1);
    setErr("");
    setInfo("");
  }

  // Recovery step 1 → look up the account's security question.
  async function findAccount(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      const { question } = await api.securityQuestion(email);
      if (!question) {
        setErr("No security question is set for this account. Check the email, or sign in with Google.");
      } else {
        setRecoverQuestion(question);
        setRecoverStep(2);
      }
    } catch (e2) {
      setErr(e2.message || "Couldn't look up that account.");
    } finally {
      setBusy(false);
    }
  }

  // Recovery step 2 → verify the answer, set the new password, then sign in.
  async function doReset(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      await api.resetPassword(email, recoverAnswer, newPassword);
      await login(email, newPassword);
      navigate("/", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Reset failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (response) => {
      clearTimeout(fallbackTimer.current);
      setErr("");
      setInfo("");
      setBusy(true);
      try {
        await loginWithGoogle(response.credential);
        navigate("/", { replace: true });
      } catch (e) {
        setErr(e.message || "Google sign-in failed. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle, navigate]
  );

  // Initialise Google Identity Services once its script has loaded + we have the client ID.
  // We do NOT render Google's own button here — its colour is browser-controlled
  // (Chrome's FedCM button ignores our theme and shows up white on dark mode).
  // Instead we drive sign-in from our own themed button via One Tap below.
  useEffect(() => {
    if (!googleClientId) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          use_fedcm_for_prompt: true,
        });
      } else if (++tries > 50) {
        clearInterval(timer);
      }
    }, 100);
    return () => { clearInterval(timer); clearTimeout(fallbackTimer.current); };
  }, [handleGoogleCredential, googleClientId]);

  function handleGoogleClick() {
    if (!window.google?.accounts?.id) {
      googleNotConfigured();
      return;
    }
    setErr("");
    setInfo("Opening Google sign-in…");
    window.google.accounts.id.prompt();
    // If the prompt is blocked, guide the user WITHOUT ever exposing account
    // details inline (we never render Google's personalized email button).
    clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(() => {
      setInfo("If the Google prompt didn't appear, allow pop-ups for this site, or sign in with your email and password below.");
    }, 2500);
  }

  function googleNotConfigured() {
    setInfo("Google sign-in isn't configured on the server yet — use email for now.");
    setTimeout(() => setInfo(""), 4000);
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center overflow-hidden relative">
      <ThemeToggle className="fixed top-5 right-5 z-20" />
      <div className="glow-background -top-20 -left-20" />
      <div
        className="glow-background -bottom-20 -right-20"
        style={{
          background:
            "radial-gradient(circle, rgba(128,131,255,0.05) 0%, rgba(128,131,255,0) 70%)",
        }}
      />

      <main className="w-full max-w-[440px] px-margin-mobile relative z-10">
        {/* Brand */}
        <div className="text-center mb-unit-xl">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tighter">
            Deadline
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit-xs">
            Precision productivity.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-unit-lg shadow-2xl">
          <div className="mb-unit-lg">
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {isRecover ? "Reset Password" : isSignup ? "Create Account" : "Sign In"}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {isRecover
                ? recoverStep === 1
                  ? "Enter your email to find your account."
                  : "Answer your security question to set a new password."
                : isSignup
                ? "Start beating your deadlines today."
                : "Welcome back to your focus zone."}
            </p>
          </div>

          <form className="space-y-unit-md" onSubmit={onFormSubmit}>
            {isSignup && (
              <div className="space-y-unit-xs">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1">
                  Full Name
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    person
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                    placeholder="Alex Rivera"
                    type="text"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-unit-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                  mail
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isRecover && recoverStep === 2}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md disabled:opacity-60"
                  placeholder="name@company.com"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password (hidden during recovery) */}
            {!isRecover && (
              <div className="space-y-unit-xs">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    lock
                  </span>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-11 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                    placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                    type={showPw ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] hover:text-on-surface transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? "visibility_off" : "visibility"}
                  </button>
                </div>
                {/* Forgot? — now below the password */}
                {!isSignup && (
                  <div className="text-right pt-1">
                    <button
                      type="button"
                      onClick={startRecover}
                      className="font-label-md text-label-md text-primary hover:underline transition-all"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Security question (sign-up) — saved for future account recovery */}
            {isSignup && (
              <>
                <div className="space-y-unit-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                    Security Question
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                      shield
                    </span>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-9 text-on-surface focus:outline-none focus:border-primary transition-all duration-200 font-body-md text-body-md"
                    >
                      {SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="space-y-unit-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                    Your Answer
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                      key
                    </span>
                    <input
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                      placeholder="Used to recover your account later"
                      type="text"
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Recovery step 2 — answer the question + set a new password */}
            {isRecover && recoverStep === 2 && (
              <>
                <div className="space-y-unit-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                    Security Question
                  </label>
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-on-surface font-body-md text-body-md">
                    {recoverQuestion}
                  </div>
                </div>
                <div className="space-y-unit-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                    Your Answer
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                      key
                    </span>
                    <input
                      value={recoverAnswer}
                      onChange={(e) => setRecoverAnswer(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                      placeholder="Your answer"
                      type="text"
                      required
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-unit-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1 block">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                      lock
                    </span>
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-11 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                      placeholder="At least 6 characters"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] hover:text-on-surface transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? "visibility_off" : "visibility"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {err && (
              <div className="flex items-start gap-2 text-error bg-error/10 border border-error/20 rounded-xl px-3 py-2 text-label-md">
                <span className="material-symbols-outlined text-[16px] mt-px">
                  error
                </span>
                <span>{err}</span>
              </div>
            )}
            {info && (
              <div className="flex items-start gap-2 text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-label-md">
                <span className="material-symbols-outlined text-[16px] mt-px">
                  info
                </span>
                <span>{info}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary-container text-on-primary-container font-headline-md text-headline-md py-3.5 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/10 mt-unit-sm disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center"
            >
              {busy ? (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              ) : isRecover ? (
                recoverStep === 1 ? "Find My Account" : "Reset Password"
              ) : isSignup ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider + social (hidden during recovery) */}
          {!isRecover && (
          <>
          <div className="relative my-unit-lg flex items-center">
            <div className="flex-grow border-t border-outline-variant/30" />
            <span className="px-3 font-label-md text-label-md text-outline-variant uppercase tracking-widest">
              or continue with
            </span>
            <div className="flex-grow border-t border-outline-variant/30" />
          </div>

          {/* Social — our own themed button drives Google sign-in (One Tap),
              so it always matches light/dark instead of Google's white pill. */}
          <button
            onClick={googleClientId ? handleGoogleClick : googleNotConfigured}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 border border-outline-variant/50 hover:bg-surface-variant/30 hover:border-outline-variant transition-all duration-200 py-3 rounded-xl font-body-md text-body-md text-on-surface disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          </>
          )}
        </div>

        {/* Redirect */}
        <p className="text-center mt-unit-lg font-body-md text-body-md text-on-surface-variant">
          {isRecover ? (
            <>
              Remembered your password?{" "}
              <button onClick={backToSignIn} className="text-primary font-semibold hover:underline">
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              {isSignup ? "Already have an account? " : "Don't have an account? "}
              <button
                onClick={() => {
                  setMode(isSignup ? "signin" : "signup");
                  setErr("");
                  setInfo("");
                }}
                className="text-primary font-semibold hover:underline"
              >
                {isSignup ? "Sign In" : "Create Account"}
              </button>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
