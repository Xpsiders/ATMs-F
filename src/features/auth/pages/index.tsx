import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, setAccessToken } from "@/shared/lib/apiClient";
import { ApiError, presentApiError } from "@/api/errors";
import {
  DEMO_ACCOUNTS,
  DEMO_ROLE_LABELS,
  isMockMode,
  startMockSession,
  startMockSessionWithCredentials,
  type DemoRole,
} from "@/mocks/auth";
import { z } from "zod";
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginResponse,
  PasswordCodeRequest,
  ResetPasswordRequest,
  SignupClaimRequest,
  SignupPasswordRequest,
  SignupVerifyRequest,
} from "@/api/contracts";
import { Icon } from "@/shared/ui/primitives";

export function Login({
  onLogin,
  onResetDemo,
}: {
  onLogin: (role?: DemoRole) => void;
  onResetDemo: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      if (isMockMode()) {
        const account = startMockSessionWithCredentials(email, password);
        if (!account) {
          setMessage("Those demo credentials don't match an account.");
          return;
        }
        onLogin(account.role);
        return;
      }
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(response.access_token);
      onLogin("student");
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "unknown";
      setMessage(
        presentApiError(
          code,
          caught instanceof Error ? caught.message : undefined,
        ).message,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-screen">
      <div className="login-aside">
        <Link to="/" className="login-brand">
          <span className="brand-mark">
            <Icon name="book" />
          </span>
          <span>
            Campus<span>Check</span>
          </span>
        </Link>
        <div className="login-quote">
          <span>YOUR CAMPUS, IN SYNC</span>
          <h1>
            Show up for
            <br />
            what's next.
          </h1>
          <p>
            One simple place to keep track of your classes, your attendance and
            your progress.
          </p>
          <div className="login-decoration">
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>© 2025 CampusCheck</small>
      </div>
      <section className="login-form-side">
        <form className="login-form" onSubmit={submitLogin}>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p>Your next class is just a few steps away.</p>
          <label className="field-label" htmlFor="login-email">
            Campus email
          </label>
          <input
            className="field-control"
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label
            className="field-label password-label"
            htmlFor="login-password"
          >
            Password <Link to="/forgot-password">Forgot password?</Link>
          </label>
          <input
            className="field-control"
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {message && (
            <div className="form-info" role="alert">
              {message}
            </div>
          )}
          <button
            className="button primary-button login-submit"
            type="submit"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"} <Icon name="arrow" />
          </button>
          <div className="login-signup">
            New to CampusCheck? <Link to="/signup">Claim your account</Link>
          </div>
        </form>
        {isMockMode() && (
          <section className="demo-accounts panel" aria-labelledby="demo-title">
            <h2 id="demo-title">Demo accounts</h2>
            <p>Choose a role to enter the matching demo workspace.</p>
            <div className="demo-account-list">
              {DEMO_ACCOUNTS.map((account) => (
                <div className="demo-account" key={account.role}>
                  <div>
                    <strong>{DEMO_ROLE_LABELS[account.role]}</strong>
                    <span>{account.email}</span>
                    <small>Password: {account.password}</small>
                  </div>
                  <button
                    className="button secondary-button"
                    type="button"
                    aria-label={`Sign in as ${DEMO_ROLE_LABELS[account.role]}`}
                    onClick={() => {
                      const session = startMockSession(account.role);
                      if (session) onLogin(session.role);
                    }}
                  >
                    Sign in <Icon name="arrow" size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="text-button demo-reset"
              type="button"
              onClick={onResetDemo}
            >
              Log out and reset demo
            </button>
          </section>
        )}
        <div className="login-footer">
          By continuing, you agree to our <a href="#terms">Terms of Use</a> and{" "}
          <a href="#privacy">Privacy Policy</a>.
        </div>
      </section>
    </main>
  );
}

export type AuthFlowType = "signup" | "verify" | "forgot" | "reset" | "change";

export type AuthStep = "identity" | "code" | "password" | "done";

export function AuthFlow({ type }: { type: AuthFlowType }) {
  const [step, setStep] = useState<AuthStep>(
    type === "signup"
      ? "identity"
      : type === "forgot"
        ? "identity"
        : type === "reset"
          ? "code"
          : type === "change"
            ? "password"
            : "code",
  );
  const [matric, setMatric] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [neutralClaimNotice, setNeutralClaimNotice] = useState(false);
  const isMock =
    import.meta.env.DEV &&
    (import.meta.env.MODE === "mock" ||
      import.meta.env.VITE_USE_MOCKS === "true");
  const heading =
    type === "signup"
      ? "Claim your student account"
      : type === "verify"
        ? "Check your email"
        : type === "forgot"
          ? "Reset your password"
          : type === "reset"
            ? "Choose a new password"
            : "Change your password";
  const helper =
    type === "signup"
      ? "Enter your student details to receive a one-time verification code."
      : type === "verify"
        ? "Enter the six-digit code sent to your campus email."
        : type === "forgot"
          ? "Enter your account email. If it matches an account, we'll send reset instructions."
          : type === "reset"
            ? "Use the code in your password reset email."
            : "For your security, choose a new password for your account.";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (type === "signup" && step === "identity") {
      const valid = z
        .object({ matric: z.string().trim().min(1), email: z.string().email() })
        .safeParse({ matric, email });
      if (!valid.success) {
        setMessage("Enter a valid matric number and campus email.");
        return;
      }
    }
    if (step === "password") {
      const valid = z
        .string()
        .min(10, "Use at least 10 characters.")
        .refine(
          (value) => value.toLowerCase() !== email.toLowerCase(),
          "Your password cannot be the same as your email.",
        )
        .safeParse(password);
      if (!valid.success) {
        setMessage(valid.error.issues[0]?.message ?? "Check your password.");
        return;
      }
    }
    setPending(true);
    try {
      if (!isMock) {
        let endpoint: string;
        let payload:
          | SignupClaimRequest
          | SignupVerifyRequest
          | SignupPasswordRequest
          | ForgotPasswordRequest
          | PasswordCodeRequest
          | ResetPasswordRequest
          | ChangePasswordRequest;
        if (type === "signup" && step === "identity") {
          endpoint = "/auth/signup/claim";
          payload = { matric, email };
        } else if (
          (type === "signup" || type === "verify") &&
          step === "code"
        ) {
          endpoint = "/auth/signup/verify";
          payload = { email, code };
        } else if (
          (type === "signup" || type === "verify") &&
          step === "password"
        ) {
          endpoint = "/auth/signup/password";
          payload = { email, password };
        } else if (type === "forgot") {
          endpoint = "/auth/password/forgot";
          payload = { email };
        } else if (type === "reset" && step === "code") {
          endpoint = "/auth/password/verify";
          payload = { email, code };
        } else if (type === "reset") {
          endpoint = "/auth/password/reset";
          payload = { email, code, password };
        } else {
          endpoint = "/auth/password/change";
          payload = { current_password: currentPassword, password };
        }
        await apiRequest<unknown>(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      if (type === "signup" && step === "identity") {
        setNeutralClaimNotice(true);
        setStep("code");
        setMessage(
          "If these details match an eligible student record, a verification code will be sent.",
        );
      } else if (type === "reset" && step === "code") {
        setStep("password");
        setMessage("Code verified. Choose a new password.");
      } else if ((type === "signup" || type === "verify") && step === "code") {
        if (step === "code") {
          setStep("password");
          setMessage(
            "Email verified. Set a password to finish creating your account.",
          );
        }
      } else if (type === "signup" || type === "verify") {
        setStep("done");
        setMessage("Your account is ready. You can now sign in.");
      } else if (type === "forgot") {
        setStep("done");
        setMessage(
          "If an account matches that email, password reset instructions will be sent.",
        );
      } else {
        setStep("done");
        setMessage(
          type === "change"
            ? "Your password has been changed."
            : "Your password has been reset.",
        );
      }
    } catch (caught) {
      const codeValue = caught instanceof ApiError ? caught.code : "unknown";
      setMessage(
        presentApiError(
          codeValue,
          caught instanceof Error ? caught.message : undefined,
        ).message,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-screen">
      <div className="login-aside">
        <Link to="/" className="login-brand">
          <span className="brand-mark">
            <Icon name="check" />
          </span>
          <span>
            Campus<span>Check</span>
          </span>
        </Link>
        <div className="login-quote">
          <span>YOUR CAMPUS, IN SYNC</span>
          <h1>
            Show up for
            <br />
            what's next.
          </h1>
          <p>
            One simple place to keep track of your classes, your attendance and
            your progress.
          </p>
          <div className="login-decoration">
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>© 2025 CampusCheck</small>
      </div>
      <section className="login-form-side">
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <span className="eyebrow">
            {type === "signup" ? "STUDENT SIGN UP" : "ACCOUNT SECURITY"}
          </span>
          <h2>
            {step === "done" && type === "signup" ? "Account created" : heading}
          </h2>
          <p>{helper}</p>
          {type === "signup" && step === "identity" && (
            <>
              <label className="field-label" htmlFor="claim-matric">
                Matric number
              </label>
              <input
                className="field-control"
                id="claim-matric"
                value={matric}
                onChange={(event) => setMatric(event.target.value)}
                required
              />
              <label className="field-label" htmlFor="claim-email">
                Campus email
              </label>
              <input
                className="field-control"
                id="claim-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </>
          )}
          {(type === "verify" ||
            (step === "code" && (type === "signup" || type === "reset"))) && (
            <>
              <label className="field-label" htmlFor="auth-code">
                One-time code
              </label>
              <input
                className="field-control"
                id="auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            </>
          )}
          {(type === "forgot" ||
            type === "reset" ||
            type === "change" ||
            type === "verify") && (
            <>
              <label className="field-label" htmlFor="auth-email">
                Campus email
              </label>
              <input
                className="field-control"
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </>
          )}
          {type === "change" && step !== "done" && (
            <>
              <label className="field-label" htmlFor="current-password">
                Current password
              </label>
              <input
                className="field-control"
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </>
          )}
          {(step === "password" || type === "reset") && step !== "done" && (
            <>
              <label className="field-label" htmlFor="new-password">
                New password
              </label>
              <input
                className="field-control"
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <div className="password-rules">
                <b>Password requirements</b>
                <span>At least 10 characters</span>
                <span>Must not be the same as your email</span>
              </div>
            </>
          )}
          {message && (
            <div
              className={neutralClaimNotice ? "form-info" : "form-info"}
              role="status"
            >
              {message}
            </div>
          )}
          {step !== "done" ? (
            <button
              className="button primary-button login-submit"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Please wait…"
                : type === "signup" && step === "identity"
                  ? "Continue"
                  : step === "code"
                    ? "Verify code"
                    : "Save password"}{" "}
              <Icon name="arrow" />
            </button>
          ) : (
            <Link className="button primary-button login-submit" to="/login">
              Continue to sign in <Icon name="arrow" />
            </Link>
          )}
          <div className="login-signup">
            <Link to="/login">Back to sign in</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
