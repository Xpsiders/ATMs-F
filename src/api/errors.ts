export type ErrorSeverity = "info" | "warning" | "error";
export type ApiErrorPresentation = { title: string; message: string; severity: ErrorSeverity; action: string };

export const API_ERRORS: Record<string, ApiErrorPresentation> = {
  wrong_code: { title: "That code doesn't match", message: "Check the six digits on the lecturer's screen and try again.", severity: "error", action: "Enter the current class code again." },
  code_expired: { title: "Code expired", message: "This code has rotated. Enter the latest code shown in class.", severity: "warning", action: "Use the current code." },
  session_closed: { title: "Class check-in has ended", message: "This attendance session is closed.", severity: "warning", action: "Contact your lecturer if you believe this is a mistake." },
  outside_radius: { title: "You're outside the class area", message: "Move closer to the class venue and try again.", severity: "warning", action: "Move near the class venue." },
  not_on_roster: { title: "You're not on this class list", message: "Your account is not registered for this course.", severity: "error", action: "Contact your department or lecturer." },
  already_checked_in: { title: "You're already checked in", message: "Your attendance has already been recorded for this session.", severity: "info", action: "View your attendance history." },
  accuracy_too_poor: { title: "Location needs a clearer signal", message: "Your location could not be confirmed accurately enough.", severity: "warning", action: "Move near a window and retry location." },
  too_many_attempts: { title: "Check-in temporarily locked", message: "There have been too many attempts. Wait for the cooldown before trying again.", severity: "error", action: "Wait for the lockout to end." },
  device_not_bound: { title: "Device approval needed", message: "This device isn't linked to your student account yet.", severity: "warning", action: "Request device approval from your lecturer." },
  code_locked: { title: "Code entry locked", message: "Code entry is temporarily locked for this session.", severity: "error", action: "Ask your lecturer for help." },
  account_temporarily_locked: { title: "Account temporarily locked", message: "Your account is temporarily locked for security.", severity: "error", action: "Wait, or contact your department." },
  token_reuse_detected: { title: "Please sign in again", message: "Your session needs to be refreshed for your security.", severity: "error", action: "Sign in again." },
  lecturer_has_open_session: { title: "You have a class in progress", message: "End or reopen your existing session before starting another.", severity: "warning", action: "Open your current session." },
  venue_has_open_session: { title: "Venue is in use", message: "Another class already has an active session at this venue.", severity: "warning", action: "Choose another venue." },
  no_active_session: { title: "No active class", message: "There is no open attendance session for this class.", severity: "warning", action: "Refresh the class list." },
  device_key_revoked: { title: "Device key revoked", message: "This scanner can no longer connect.", severity: "error", action: "Ask an administrator to register the scanner again." },
  device_scope_denied: { title: "You can't manage this scanner", message: "This scanner is outside your administrator or teaching scope.", severity: "warning", action: "Ask an administrator with authority over the venue." },
  device_not_found: { title: "Scanner not found", message: "This scanner no longer exists or has been removed.", severity: "warning", action: "Refresh the scanner list." },
  student_not_found: { title: "Student not found", message: "That student record could not be found in your scope.", severity: "warning", action: "Pick another student from the directory." },
  invalid_request: { title: "Check the details", message: "Some required information is missing or invalid.", severity: "error", action: "Review the form and try again." },
  course_has_offerings: { title: "Course still has offerings", message: "Remove this course's offerings before deleting it.", severity: "warning", action: "Delete its offerings first, then try again." },
  course_not_found: { title: "Course not found", message: "This course no longer exists or has been removed.", severity: "warning", action: "Refresh the course list." },
  rate_limited: { title: "Please slow down", message: "Too many requests were made. Try again when the cooldown ends.", severity: "warning", action: "Wait for the cooldown." },
};

export function presentApiError(code: string, serverMessage?: string): ApiErrorPresentation {
  return API_ERRORS[code] ?? {
    title: "Something went wrong",
    message: serverMessage?.trim() || "Please try again. If the problem continues, contact support.",
    severity: "error",
    action: "Try again.",
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Request failed. Please try again.";
}
