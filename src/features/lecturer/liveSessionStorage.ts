type RememberedLiveSession = {
  sessionId: string;
  offeringId: string;
};

function storageKey(userId: string) {
  return `campuscheck-live-session:${userId}`;
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

export function forgetLiveSession(userId: string, sessionId: string) {
  try {
    if (getRememberedLiveSession(userId)?.sessionId === sessionId)
      sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Storage may be unavailable; the server remains the source of truth.
  }
}
