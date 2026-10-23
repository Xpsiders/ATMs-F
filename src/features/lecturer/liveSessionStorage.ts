import type { StartSessionResponse } from "@/api/contracts";

type RememberedLiveSession = {
  sessionId: string;
  offeringId: string;
};

export type RememberedSessionReport = {
  sessionId: StartSessionResponse["session"]["id"];
  offeringId: StartSessionResponse["session"]["offering_id"];
  startedAt: StartSessionResponse["session"]["started_at"];
  offeringLabel: string;
};

function storageKey(userId: string) {
  return `campuscheck-live-session:${userId}`;
}

function reportsStorageKey(userId: string) {
  return `campuscheck-session-reports:${userId}`;
}

function isRememberedSessionReport(
  value: unknown,
): value is RememberedSessionReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "sessionId" in value &&
    typeof value.sessionId === "string" &&
    "offeringId" in value &&
    typeof value.offeringId === "string" &&
    "startedAt" in value &&
    typeof value.startedAt === "string" &&
    "offeringLabel" in value &&
    typeof value.offeringLabel === "string"
  );
}

export function getRememberedLiveSession(
  userId: string,
): RememberedLiveSession | null {
  try {
    const stored = sessionStorage.getItem(storageKey(userId));
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (
      typeof value !== "object" ||
      value === null ||
      !("sessionId" in value) ||
      typeof value.sessionId !== "string" ||
      !("offeringId" in value) ||
      typeof value.offeringId !== "string"
    )
      return null;
    return { sessionId: value.sessionId, offeringId: value.offeringId };
  } catch {
    return null;
  }
}

export function rememberLiveSession(
  userId: string,
  session: RememberedLiveSession,
) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(session));
  } catch {
    // The start-session URL still carries the session ID for this visit.
  }
}

export function rememberSessionReport(
  userId: string,
  session: StartSessionResponse["session"],
  offeringLabel: string,
) {
  const report: RememberedSessionReport = {
    sessionId: session.id,
    offeringId: session.offering_id,
    startedAt: session.started_at,
    offeringLabel,
  };
  try {
    const previous = getRememberedSessionReports(userId);
    localStorage.setItem(
      reportsStorageKey(userId),
      JSON.stringify([
        report,
        ...previous.filter((item) => item.sessionId !== report.sessionId),
      ].slice(0, 50)),
    );
  } catch {
    // The live-session route still works if report history storage is unavailable.
  }
}

export function getRememberedSessionReports(
  userId: string,
): RememberedSessionReport[] {
  try {
    const stored = localStorage.getItem(reportsStorageKey(userId));
    if (!stored) return [];
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value.filter(isRememberedSessionReport) : [];
  } catch {
    return [];
  }
}

export function clearRememberedSessions(userId: string) {
  try {
    sessionStorage.removeItem(storageKey(userId));
    localStorage.removeItem(reportsStorageKey(userId));
  } catch {
    // Storage may be unavailable; server state is unaffected.
  }
}

export function forgetLiveSession(userId: string, sessionId: string) {
  try {
    if (getRememberedLiveSession(userId)?.sessionId === sessionId)
      sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Storage may be unavailable; the server remains the source of truth.
  }
}
