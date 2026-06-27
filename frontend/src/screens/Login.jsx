import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const googleBtnRef = useRef(null);

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  // Client ID from build-time env (local dev) OR fetched from the backend at runtime (prod).
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  );

  const isSignup = mode === "signup";

  useEffect(() => {
    api
      .authConfig()
      .then((c) => c?.google_client_id && setGoogleClientId(c.google_client_id))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (isSignup) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (e2) {
      setErr(e2.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (response) => {
      setErr("");
      setBusy(true);
      try {
        await loginWithGoogle(response.credential);
        navigate(from, { replace: true });
      } catch (e) {
        setErr(e.message || "Google sign-in failed. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle, navigate, from]
  );

  // Initialise Google Identity Services once its script has loaded + we have the client ID.
  useEffect(() => {
    if (!googleClientId) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "filled_black",
            size: "large",
            width: 360,
            text: "continue_with",
            shape: "pill",
          });
        }
      } else if (++tries > 50) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [handleGoogleCredential, googleClientId]);

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
              {isSignup ? "Create Account" : "Sign In"}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {isSignup
                ? "Start beating your deadlines today."
                : "Welcome back to your focus zone."}
            </p>
          </div>

          <form className="space-y-unit-md" onSubmit={submit}>
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
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-all duration-200 input-focus-glow font-body-md text-body-md"
                  placeholder="name@company.com"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-unit-xs">
              <div className="flex justify-between items-center px-1">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Password
                </label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={() => setInfo("Password reset is coming soon.")}
                    className="font-label-md text-label-md text-primary hover:underline transition-all"
                  >
                    Forgot?
                  </button>
                )}
              </div>
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
            </div>

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
              ) : isSignup ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-unit-lg flex items-center">
            <div className="flex-grow border-t border-outline-variant/30" />
            <span className="px-3 font-label-md text-label-md text-outline-variant uppercase tracking-widest">
              or continue with
            </span>
            <div className="flex-grow border-t border-outline-variant/30" />
          </div>

          {/* Social — official Google button when configured, else a hint */}
          {googleClientId ? (
            <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
          ) : (
            <button
              onClick={googleNotConfigured}
              className="w-full flex items-center justify-center gap-2 border border-outline-variant/50 hover:bg-surface-variant/30 transition-all duration-200 py-3 rounded-xl font-body-md text-body-md text-on-surface"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          )}
        </div>

        {/* Redirect */}
        <p className="text-center mt-unit-lg font-body-md text-body-md text-on-surface-variant">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setErr("");
            }}
            className="text-primary font-semibold hover:underline"
          >
            {isSignup ? "Sign In" : "Create Account"}
          </button>
        </p>
      </main>
    </div>
  );
}
