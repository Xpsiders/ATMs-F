import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, setAccessToken } from "@/shared/lib/apiClient";
import { ApiError, presentApiError } from "@/api/errors";
import {
  DEMO_ACCOUNTS,
  DEMO_INSTITUTION_ID,
  DEMO_PASSWORD_RESET_CODE,
  DEMO_ROLE_LABELS,
  isMockMode,
  startMockSession,
  startMockSessionWithCredentials,
  type DemoRole,
} from "@/mocks/auth";
import { z } from "zod";
import type {
  ChangePasswordRequest,
  LoginResponse,
  LoginRequest,
  RequestPasswordReset,
  RequestPasswordResetResponse,
  ResetPasswordRequest,
  PublicDepartment,
  PublicDepartmentsResponse,
  SignupClaimRequest,
  SignupVerifyRequest,
} from "@/api/contracts";
import { Icon } from "@/shared/ui/primitives";

export function Login({
  onLogin,
  onResetDemo,
}: {
  onLogin: (role?: DemoRole) => void | Promise<void>;
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
        await onLogin(account.role);
        return;
      }
      const institutionId = import.meta.env.VITE_INSTITUTION_ID;
      if (!institutionId) {
        setMessage("Set VITE_INSTITUTION_ID to sign in with the API.");
        return;
      }
      const payload: LoginRequest = {
        institution_id: institutionId,
        email,
        password,
      };
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAccessToken(response.access_token);
      await onLogin();
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
                    onClick={async () => {
                      const session = startMockSession(account.role);
                      if (!session) return;
                      setMessage("");
                      try {
                        await onLogin(session.role);
                      } catch (caught) {
                        const code =
                          caught instanceof ApiError ? caught.code : "unknown";
                        setMessage(
                          presentApiError(
                            code,
                            caught instanceof Error
                              ? caught.message
                              : undefined,
                          ).message,
                        );
                      }
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
  const [departmentId, setDepartmentId] = useState("");
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
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState("");
  const [departmentsReloadKey, setDepartmentsReloadKey] = useState(0);
  const institutionId =
    import.meta.env.VITE_INSTITUTION_ID ??
    (isMock ? DEMO_INSTITUTION_ID : undefined);
  // The claim screen is pre-login: load the institution's departments from the
  // public, unauthenticated endpoint so students pick a name, never a UUID.
  useEffect(() => {
    if (type !== "signup") return;
    if (!institutionId) {
      setDepartmentsError("Set VITE_INSTITUTION_ID to load departments.");
      return;
    }
    const base =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const controller = new AbortController();
    setDepartmentsLoading(true);
    setDepartmentsError("");
    void (async () => {
      try {
        const response = await fetch(
          `${base}/public/departments?institution_id=${encodeURIComponent(
            institutionId,
          )}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error("We couldn't load the department list.");
        const body = (await response.json()) as PublicDepartmentsResponse;
        setDepartments(body.items ?? []);
      } catch (caught) {
        if ((caught as { name?: string }).name === "AbortError") return;
        setDepartmentsError(
          "We couldn't load the department list. Please try again.",
        );
      } finally {
        setDepartmentsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [type, institutionId, departmentsReloadKey]);
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
      if (!departmentId) {
        setMessage("Select your department.");
        return;
      }
    }
    if (step === "password") {
      const valid = z
        .string()
        .min(12, "Use at least 12 characters.")
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
    if (!isMock && type === "verify") {
      setMessage(
        "This flow is not available in the current API contract. Please contact your institution administrator.",
      );
      return;
    }
    setPending(true);
    try {
      if (!isMock || type === "forgot" || type === "reset") {
        let endpoint: string | null = null;
        let payload:
          | SignupClaimRequest
          | SignupVerifyRequest
          | ChangePasswordRequest
          | null = null;
        if (type === "signup" && step === "identity") {
          const institutionId =
            import.meta.env.VITE_INSTITUTION_ID ??
            (isMock ? DEMO_INSTITUTION_ID : undefined);
          if (!institutionId) {
            setMessage("Set VITE_INSTITUTION_ID to claim an account.");
            return;
          }
          endpoint = "/auth/signup-claim";
          payload = {
            institution_id: institutionId,
            matric_no: matric,
            email,
            department_id: departmentId,
          };
        } else if (type === "signup" && step === "password") {
          const institutionId =
            import.meta.env.VITE_INSTITUTION_ID ??
            (isMock ? DEMO_INSTITUTION_ID : undefined);
          if (!institutionId) {
            setMessage("Set VITE_INSTITUTION_ID to verify your account.");
            return;
          }
          endpoint = "/auth/verify-email";
          payload = {
            institution_id: institutionId,
            matric_no: matric,
            code,
            password,
          };
        } else if (type === "change") {
          endpoint = "/auth/password/change";
          payload = {
            current_password: currentPassword,
            new_password: password,
          };
        } else if (type === "forgot") {
          const institutionId =
            import.meta.env.VITE_INSTITUTION_ID ??
            (isMock ? DEMO_INSTITUTION_ID : undefined);
          if (!institutionId) {
            setMessage("Set VITE_INSTITUTION_ID to request a password reset.");
            return;
          }
          const resetRequest: RequestPasswordReset = {
            institution_id: institutionId,
            email,
          };
          await apiRequest<RequestPasswordResetResponse>(
            "/auth/password/forgot",
            {
              method: "POST",
              body: JSON.stringify(resetRequest),
            },
          );
        } else if (type === "reset") {
          const institutionId =
            import.meta.env.VITE_INSTITUTION_ID ??
            (isMock ? DEMO_INSTITUTION_ID : undefined);
          if (!institutionId) {
            setMessage("Set VITE_INSTITUTION_ID to reset your password.");
            return;
          }
          const resetRequest: ResetPasswordRequest = {
            institution_id: institutionId,
            email,
            code,
            new_password: password,
          };
          await apiRequest<void>("/auth/password/reset", {
            method: "POST",
            body: JSON.stringify(resetRequest),
          });
        } else if (type === "signup" && step === "code") {
          endpoint = null;
        } else {
          setMessage(
            "This flow is not available in the current API contract.",
          );
          return;
        }
        if (endpoint && payload) {
          await apiRequest<unknown>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
      }
      if (type === "signup" && step === "identity") {
        setNeutralClaimNotice(true);
        setStep("code");
        setMessage(
          "If these details match an eligible student record, a verification code will be sent.",
        );
      } else if (type === "reset" && step === "code") {
        setStep("done");
        setMessage("Your password has been reset. You can now sign in.");
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
          isMock
            ? `If an account matches that email, password reset instructions will be sent. Demo code: ${DEMO_PASSWORD_RESET_CODE}.`
            : "If an account matches that email, password reset instructions will be sent.",
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
              <label className="field-label" htmlFor="claim-department">
                Department
              </label>
              {departmentsError ? (
                <div className="form-info" role="alert">
                  {departmentsError}
                  {institutionId && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setDepartmentsReloadKey((key) => key + 1)
                      }
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <select
                  className="field-control"
                  id="claim-department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  required
                  disabled={departmentsLoading || departments.length === 0}
                >
                  <option value="" disabled>
                    {departmentsLoading
                      ? "Loading departments…"
                      : "Select your department"}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code
                        ? `${department.name} (${department.code})`
                        : department.name}
                    </option>
                  ))}
                </select>
              )}
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
                <span>At least 12 characters</span>
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
              disabled={
                pending ||
                (type === "signup" &&
                  step === "identity" &&
                  (departmentsLoading || departmentsError !== ""))
              }
            >
              {pending
                ? "Please wait…"
                : type === "signup" && step === "identity"
                  ? "Continue"
                  : type === "reset"
                    ? "Reset password"
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
