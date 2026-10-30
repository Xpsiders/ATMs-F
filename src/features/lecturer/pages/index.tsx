import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { apiRequest, downloadApiFile } from "@/shared/lib/apiClient";
import { useServerCode } from "@/shared/hooks/useServerCode";
import { requestScreenWakeLock } from "@/shared/lib/wakeLock";
import { formatDate, formatInitials, formatTime } from "@/shared/lib/format";
import { tryGetCurrentPosition } from "@/shared/lib/geo";
import { ApiError, formatApiError, presentApiError } from "@/api/errors";
import type {
  AttendanceOverrideRequest,
  BulkOverrideResponse,
  CurrentUser,
  EndSessionResponse,
  LiveSessionResponse,
  OfferingsResponse,
  RosterPage,
  RosterSheetRow,
  SessionLocationRequest,
  SessionLocationResult,
  SessionLocationSource,
  StartSessionRequest,
  StartSessionResponse,
  CaptureVenueLocationRequest,
  CaptureVenueLocationResponse,
  SessionPatchRequest,
  SessionPatchResponse,
  SessionReportResponse,
  VenueListResponse,
  VenueScannerStatusResponse,
} from "@/api/contracts";
import {
  Icon,
  isOverrideReason,
  isOverrideStatus,
  PageHeading,
} from "@/shared/ui/primitives";
import {
  overrideDemoAttendance,
  setDemoScannerStatus,
  type DemoAttendance,
} from "@/mocks/store";
import { isMockMode } from "@/mocks/auth";
import { useDemoState } from "@/mocks/useDemoState";
import {
  forgetLiveSession,
  getRememberedLiveSession,
  getRememberedSessionReports,
  rememberLiveSession,
  rememberSessionReport,
} from "../liveSessionStorage";

type ReportDisplayRow = {
  id: string;
  name: string;
  matric: string;
  department: string;
  web: string;
  scan: string;
  status: string;
  attendanceLabel: string;
  classificationClass: string;
  label: string;
  flags: string[];
};

function getClassificationLabel(
  classification: LiveSessionResponse["items"][number]["classification"],
) {
  const labels: Record<
    LiveSessionResponse["items"][number]["classification"],
    string
  > = {
    verified: "Verified",
    present_no_web_log: "Scan only",
    web_only_unverified: "Needs confirmation",
    proxy: "Needs review (proxy)",
    absent: "Absent",
    excused: "Excused",
  };
  return labels[classification];
}

/**
 * Every reason the server can give for a row it could not verify. They are all
 * rendered with the same wording and the same severity: the server cannot tell
 * a stand-in from a queue at the sensor, a finger that will not read, or a
 * student who did not know to scan, so none of them implies cheating.
 */
const NEEDS_CONFIRMATION_REASONS: Record<string, string> = {
  scanner_unavailable: "Scanner marked unavailable",
  scanner_offline: "No scanner heartbeat at check-in",
  location_unverified: "Location could not be matched",
  no_fingerprint: "No fingerprint scan",
};

function getReasonLabel(reason: string): string {
  return NEEDS_CONFIRMATION_REASONS[reason] ?? reason;
}

/**
 * What a mid-session fix was allowed to do. The geofence deliberately does not
 * follow the lecturer out of the room, so a rejected fix is normal and is
 * reported as information, never as an error.
 */
function getLocationOutcomeNote(result: SessionLocationResult): string {
  switch (result.outcome) {
    case "refined":
      return "This room's saved location was sharpened from this device.";
    case "established":
      return "This room now has a saved location, set from this device.";
    case "rejected_accuracy":
      return "The last position was too vague to use, so the check-in area is unchanged.";
    case "rejected_distance":
      return "This device is outside the check-in area, so the area stayed with the students in the room.";
    default:
      return "";
  }
}

/** The location source handed over by the start-session navigation, if any. */
function readLocationSource(state: unknown): SessionLocationSource | null {
  if (typeof state !== "object" || state === null || !("locationSource" in state))
    return null;
  const source: unknown = (state as { locationSource: unknown }).locationSource;
  return source === "device" || source === "venue" || source === "none"
    ? source
    : null;
}

const SESSION_LOCATION_NOTES: Record<SessionLocationSource, string> = {
  device: "",
  venue:
    "This room's own saved location was used. Start the next class here with location on to sharpen it.",
  none:
    "This class has no check-in area, so check-ins carry no distance. Attendance still works normally.",
};

function getClassificationClass(
  classification: LiveSessionResponse["items"][number]["classification"],
) {
  if (classification === "proxy") return "web_only_unverified";
  if (classification === "present_no_web_log") return "scan_only";
  return classification;
}

function getAttendanceStatusLabel(status: string) {
  return status.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getAllLiveSessionRows(
  sessionId: string,
): Promise<LiveSessionResponse> {
  let offset = 0;
  let firstPage: LiveSessionResponse | null = null;
  const items: LiveSessionResponse["items"] = [];
  while (true) {
    const page = await apiRequest<LiveSessionResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/live?limit=200&offset=${offset}`,
    );
    firstPage ??= page;
    items.push(...page.items);
    if (!page.has_more || page.items.length === 0) break;
    offset += page.items.length;
  }
  if (!firstPage) throw new Error("The API returned no live session roster.");
  return { ...firstPage, items };
}

async function getAllSessionReportRows(
  sessionId: string,
): Promise<SessionReportResponse> {
  let offset = 0;
  let firstPage: SessionReportResponse | null = null;
  const items: SessionReportResponse["items"] = [];
  while (true) {
    const page = await apiRequest<SessionReportResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/report?limit=200&offset=${offset}`,
    );
    firstPage ??= page;
    items.push(...page.items);
    if (!page.has_more || page.items.length === 0) break;
    offset += page.items.length;
  }
  if (!firstPage) throw new Error("The API returned no session report.");
  return { ...firstPage, items };
}

const ATTENDANCE_STATUS_LABELS: Record<DemoAttendance["status"], string> = {
  verified: "Verified",
  needs_confirmation: "Needs confirmation",
  scan_only: "Scan only",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

function getDemoClassificationLabel(status: DemoAttendance["status"]) {
  switch (status) {
    case "needs_confirmation":
    case "late":
      return "Needs confirmation";
    case "scan_only":
      return "Scan only";
    case "absent":
      return "Absent";
    case "excused":
      return "Excused";
    default:
      return "Verified";
  }
}

function getDemoAttendanceStatus(status: DemoAttendance["status"]) {
  return status === "late" || status === "absent" || status === "excused"
    ? status
    : "present";
}

function getOfferingLabel(offering: OfferingsResponse["items"][number]) {
  const code =
    typeof offering.course_code === "string"
      ? offering.course_code
      : typeof offering.code === "string"
        ? offering.code
        : undefined;
  const title =
    typeof offering.course_title === "string"
      ? offering.course_title
      : typeof offering.title === "string"
        ? offering.title
        : undefined;
  if (code && title) return `${code} · ${title}`;
  return code ?? title ?? "Course details unavailable";
}

function getFieldErrors(error: unknown): { field: string; message: string }[] {
  if (
    !(error instanceof ApiError) ||
    typeof error.details !== "object" ||
    !error.details
  )
    return [];
  const details = error.details;
  if (
    !("fields" in details) ||
    typeof details.fields !== "object" ||
    !details.fields
  )
    return [];
  return Object.entries(details.fields).flatMap(([field, value]) => {
    const messages =
      typeof value === "string"
        ? [value]
        : Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];
    return messages.map((message) => ({ field, message }));
  });
}

/** The open session that a 409 venue_session_already_open points at. */
function getOpenSessionId(error: unknown): string {
  if (
    !(error instanceof ApiError) ||
    error.code !== "venue_session_already_open" ||
    typeof error.details !== "object" ||
    !error.details ||
    !("session_id" in error.details) ||
    typeof error.details.session_id !== "string"
  )
    return "";
  return error.details.session_id;
}

export function Teaching({ user }: { user: CurrentUser }) {
  const [offerings, setOfferings] =
    useState<OfferingsResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const sessionReports = getRememberedSessionReports(user.id);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiRequest<OfferingsResponse>("/me/offerings?limit=200&offset=0")
      .then((response) => {
        if (active) setOfferings(response.items);
      })
      .catch((caught: unknown) => {
        if (active) setError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="LECTURER WORKSPACE"
        title={`Welcome, ${user.name}`}
        subtitle="Your assigned offerings are listed below. Start a session for the class when students arrive."
        action={
          <Link to="/lecturer/start" className="button primary-button">
            <Icon name="calendar" /> Start a session
          </Link>
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>My offerings</h2>
            <p>Offerings available to your lecturer account</p>
          </div>
        </div>
        {loading ? (
          <p role="status">Loading your offerings…</p>
        ) : error ? (
          <div className="api-state-error" role="alert">
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Retry
            </button>
          </div>
        ) : offerings.length ? (
          offerings.map((offering) => (
            <div className="teaching-row" key={offering.id}>
              <div>
                <b>{getOfferingLabel(offering)}</b>
                <span className={`status-chip ${offering.session_open ? "verified" : "absent"}`}>
                  <i />
                  {offering.session_open ? "Session live" : "No live session"}
                </span>
                {offering.next_timetable_slot && (
                  <span>
                    Next class: {offering.next_timetable_slot.venue_name ?? "Venue not specified"} ·{" "}
                    {offering.next_timetable_slot.next_at ??
                      `${offering.next_timetable_slot.starts_at}–${offering.next_timetable_slot.ends_at}`}
                  </span>
                )}
              </div>
              {offering.session_open ? (
                getRememberedLiveSession(user.id)?.offeringId ===
                offering.id ? (
                  <Link
                    to="/lecturer/live"
                    className="text-button"
                    aria-label={`View live ${getOfferingLabel(offering)} session`}
                  >
                    View live session <Icon name="arrow" size={15} />
                  </Link>
                ) : (
                  <span className="text-button" aria-label="Session already live">
                    Session already live
                  </span>
                )
              ) : (
                <Link
                  to={`/lecturer/start?offeringId=${encodeURIComponent(offering.id)}`}
                  className="text-button"
                  aria-label={`Start ${getOfferingLabel(offering)} session`}
                >
                  Start session <Icon name="arrow" size={15} />
                </Link>
              )}
            </div>
          ))
        ) : (
          <p className="empty-state">
            No offerings are assigned to your lecturer account.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent session reports</h2>
            <p>Reports remain available after a session ends.</p>
          </div>
        </div>
        {sessionReports.length ? (
          sessionReports.map((report) => (
            <div className="teaching-row" key={report.sessionId}>
              <div>
                <b>{report.offeringLabel}</b>
                <span>
                  Session started{" "}
                  {new Date(report.startedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <Link
                to={`/lecturer/report?sessionId=${encodeURIComponent(report.sessionId)}`}
                className="text-button"
                aria-label={`View session report for ${report.offeringLabel}`}
              >
                View session report <Icon name="arrow" size={15} />
              </Link>
            </div>
          ))
        ) : (
          <p className="empty-state">Session reports will appear here after you start a session.</p>
        )}
      </section>
    </div>
  );
}

export function StartSession({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedOfferingId = searchParams.get("offeringId");
  const [offerings, setOfferings] =
    useState<OfferingsResponse["items"]>([]);
  const [venues, setVenues] = useState<VenueListResponse["items"]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [rotatingCode, setRotatingCode] = useState(true);
  const [lateAfterMin, setLateAfterMin] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    { field: string; message: string }[]
  >([]);
  const [locating, setLocating] = useState(false);
  const [openSessionId, setOpenSessionId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      apiRequest<OfferingsResponse>("/me/offerings?limit=200&offset=0"),
      apiRequest<VenueListResponse>("/venues"),
    ])
      .then(([offeringResponse, venueResponse]) => {
        if (!active) return;
        setOfferings(offeringResponse.items);
        setVenues(venueResponse.items);
        setOfferingId(
          offeringResponse.items.find(
            (offering) => offering.id === requestedOfferingId,
          )?.id ??
            offeringResponse.items[0]?.id ??
            "",
        );
        setVenueId(
          venueResponse.items[1]?.id ?? venueResponse.items[0]?.id ?? "",
        );
      })
      .catch((caught: unknown) => {
        if (active) setError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedOfferingId]);

  async function startSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offeringId || !venueId) {
      setError("Choose an offering and venue before starting the session.");
      return;
    }
    setSaving(true);
    setError("");
    setFieldErrors([]);
    setOpenSessionId("");
    const selectedOffering = offerings.find(
      (offering) => offering.id === offeringId,
    );
    if (!selectedOffering) {
      setError("The selected offering is no longer available. Reload and try again.");
      setSaving(false);
      return;
    }
    // The lecturer is the only person in the room, so their device is the one
    // real source for where the room is. A denied permission or a timeout must
    // never stop the class: the three location fields are simply omitted, and
    // the server falls back to the venue's own centre, or to no geofence.
    setLocating(true);
    const fix = await tryGetCurrentPosition();
    setLocating(false);
    const payload: StartSessionRequest = {
      offering_id: offeringId,
      venue_id: venueId,
      rotating_code: rotatingCode,
      late_after_min: lateAfterMin,
      ...(fix
        ? {
            latitude: fix.lat,
            longitude: fix.lng,
            // Sent exactly as the browser reported it; the server decides
            // whether the fix is precise enough to trust.
            accuracy_meters: fix.accuracy,
          }
        : {}),
    };
    try {
      const result = await apiRequest<StartSessionResponse>("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      rememberLiveSession(user.id, {
        sessionId: result.session.id,
        offeringId: result.session.offering_id,
      });
      rememberSessionReport(
        user.id,
        result.session,
        getOfferingLabel(selectedOffering),
      );
      navigate(
        `/lecturer/live?sessionId=${encodeURIComponent(result.session.id)}`,
        { state: { locationSource: result.location_source ?? null } },
      );
    } catch (caught) {
      setError(formatApiError(caught));
      setFieldErrors(getFieldErrors(caught));
      setOpenSessionId(getOpenSessionId(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="LECTURER WORKSPACE"
        title="Start an attendance session"
        subtitle="Choose an offering, venue and attendance options."
      />
      <form className="panel start-session-form" onSubmit={startSession}>
        {error && (
          <div className="form-error" role="alert">
            {error}
            {fieldErrors.length > 0 && (
              <ul className="form-field-errors" aria-label="Field errors">
                {fieldErrors.map(({ field, message }, index) => (
                  <li key={`${field}-${index}`}>
                    <strong>{field}</strong>: {message}
                  </li>
                ))}
              </ul>
            )}
            {openSessionId && (
              <p>
                <Link
                  className="text-button"
                  to={`/lecturer/live?sessionId=${encodeURIComponent(openSessionId)}`}
                >
                  Open the session already running at this venue
                </Link>
              </p>
            )}
          </div>
        )}
        {loading ? (
          <p role="status">Loading offerings and venues…</p>
        ) : (
          <>
            <label className="field-label" htmlFor="session-offering">
              Offering
            </label>
            <select
              id="session-offering"
              className="field-control"
              value={offeringId}
              onChange={(event) => setOfferingId(event.target.value)}
              required
              disabled={!offerings.length}
            >
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {getOfferingLabel(offering)}
                </option>
              ))}
            </select>
            {!offerings.length && (
              <p role="status">No offerings are available to you.</p>
            )}
            <label className="field-label" htmlFor="session-venue">
              Venue
            </label>
            <select
              id="session-venue"
              className="field-control"
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              required
              disabled={!venues.length}
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
            {!venues.length && (
              <p role="status">No venues are available to you.</p>
            )}
            <label className="field-label" htmlFor="late-after-min">
              Mark late after (minutes)
            </label>
            <input
              id="late-after-min"
              className="field-control"
              type="number"
              min={0}
              max={240}
              step={1}
              value={lateAfterMin}
              onChange={(event) => setLateAfterMin(Number(event.target.value))}
              required
            />
            <label className="session-option">
              <input
                type="checkbox"
                checked={rotatingCode}
                onChange={(event) => setRotatingCode(event.target.checked)}
              />
              Use rotating attendance code
            </label>
            <p className="field-note">
              If you allow location, this device sets where the room is for
              today's check-ins and sharpens it for the next class. Starting the
              class never waits on it: decline, and attendance still works.
            </p>
            <button
              className="button primary-button"
              type="submit"
              disabled={saving || !offeringId || !venueId}
            >
              {saving
                ? locating
                  ? "Checking this room's location…"
                  : "Starting session…"
                : "Start session"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export function LiveSession({ user }: { user: CurrentUser }) {
  const mock = isMockMode();
  const demoState = useDemoState(mock);
  const [searchParams] = useSearchParams();
  const [reloadLiveKey, setReloadLiveKey] = useState(0);
  const [liveData, setLiveData] = useState<LiveSessionResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [offerings, setOfferings] = useState<OfferingsResponse["items"]>([]);
  const [venues, setVenues] = useState<VenueListResponse["items"]>([]);
  const requestedSessionId = searchParams.get("sessionId");
  const rememberedSession = getRememberedLiveSession(user.id);
  const rememberedDemoSession = mock
    ? demoState.sessions.find(
        (session) =>
          session.id === rememberedSession?.sessionId &&
          session.state === "live",
      )
    : undefined;
  const sessionId =
    requestedSessionId ??
    (mock
      ? (rememberedDemoSession?.id ??
        rememberedSession?.sessionId ??
        demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : (rememberedSession?.sessionId ?? ""));
  const demoSession = demoState.sessions.find(
    (session) => session.id === sessionId,
  );
  const demoOffering = demoState.offerings.find(
    (offering) => offering.id === demoSession?.offeringId,
  );
  const [projector, setProjector] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const [boardTheme, setBoardTheme] = useState<"dark" | "light">("dark");
  const [localFixedCode, setLocalFixedCode] = useState<string | null>(null);
  const [localEnded, setLocalEnded] = useState(false);
  const [scannerStatus, setScannerStatus] =
    useState<VenueScannerStatusResponse | null>(null);
  const [scannerStatusError, setScannerStatusError] = useState("");
  const [scannerStatusLoading, setScannerStatusLoading] = useState(false);
  const [projectorUnavailable, setProjectorUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [locationResult, setLocationResult] =
    useState<SessionLocationResult | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [recalibrating, setRecalibrating] = useState(false);
  const [recalibrateNote, setRecalibrateNote] = useState("");
  const { state: routerState } = useLocation();
  const startLocationSource = readLocationSource(routerState);
  const fixedCode =
    localFixedCode ??
    (mock && demoSession && !demoSession.rotating ? demoSession.code : null);
  const ended = localEnded || (mock && demoSession?.state === "ended");
  const scannerOffline = scannerStatus?.status === "offline";
  const {
    code,
    seconds,
    error: codeError,
    session: apiSession,
  } = useServerCode(
    sessionId,
    Boolean(
      sessionId &&
        !ended &&
        !fixedCode &&
        (!mock || demoSession?.rotating !== false),
    ),
  );
  useEffect(() => {
    if (mock || !sessionId || ended) return;
    let active = true;
    let inFlight = false;
    setLiveData(null);
    setLiveError("");
    const load = async (initial = false) => {
      if (inFlight) return;
      inFlight = true;
      if (initial) setLiveLoading(true);
      try {
        const result = await getAllLiveSessionRows(sessionId);
        if (active) {
          setLiveData(result);
          setLiveError("");
        }
      } catch (caught) {
        if (active) setLiveError(formatApiError(caught));
      } finally {
        inFlight = false;
        if (active) setLiveLoading(false);
      }
    };
    void load(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void load();
    }, 5_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ended, mock, reloadLiveKey, sessionId]);
  // The contract asks for the lecturer's current fix about every five minutes
  // while the session is open, and whenever the app returns to the foreground.
  // A failed post is never replayed: the next tick captures a fresh fix.
  useEffect(() => {
    if (!sessionId || ended) return;
    let active = true;
    let inFlight = false;
    const send = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const fix = await tryGetCurrentPosition();
        if (!fix || !active) return;
        const payload: SessionLocationRequest = {
          latitude: fix.lat,
          longitude: fix.lng,
          accuracy_meters: fix.accuracy,
        };
        const result = await apiRequest<SessionLocationResult>(
          `/sessions/${encodeURIComponent(sessionId)}/location`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        if (!active) return;
        setLocationResult(result);
        setLocationNote(getLocationOutcomeNote(result));
      } catch {
        // A re-check that does not land changes nothing: the geofence already
        // in force stays as it is, and students keep checking in against it.
      } finally {
        inFlight = false;
      }
    };
    void send();
    const timer = window.setInterval(() => void send(), 5 * 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ended, sessionId]);
  useEffect(() => {
    if (mock) return;
    let active = true;
    void Promise.all([
      apiRequest<OfferingsResponse>("/me/offerings"),
      apiRequest<VenueListResponse>("/venues?limit=200&offset=0"),
    ])
      .then(([offeringResponse, venueResponse]) => {
        if (!active) return;
        setOfferings(offeringResponse.items);
        setVenues(venueResponse.items);
      })
      .catch((caught: unknown) => {
        if (active) setNotice(formatApiError(caught));
      });
    return () => {
      active = false;
    };
  }, [mock]);
  const apiOffering = offerings.find(
    (offering) => offering.id === apiSession?.offering_id,
  );
  const apiVenue = venues.find((venue) => venue.id === apiSession?.venue_id);
  const venueId = apiSession?.venue_id ?? demoSession?.venueId;
  useEffect(() => {
    if (!venueId) {
      setScannerStatus(null);
      setScannerStatusError("");
      setScannerStatusLoading(false);
      return;
    }
    let active = true;
    let inFlight = false;
    setScannerStatus(null);
    setScannerStatusError("");
    setScannerStatusLoading(true);
    const loadStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await apiRequest<VenueScannerStatusResponse>(
          `/venues/${encodeURIComponent(venueId)}/scanner-status`,
        );
        if (active) {
          setScannerStatus(result);
          setScannerStatusError("");
        }
      } catch (caught) {
        if (active) setScannerStatusError(formatApiError(caught));
      } finally {
        inFlight = false;
        if (active) setScannerStatusLoading(false);
      }
    };
    void loadStatus();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStatus();
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [demoState.scanners, venueId]);
  const activeCode = fixedCode ?? code;
  const demoRosterRows = demoState.attendance
    .filter((record) => record.sessionId === sessionId)
    .flatMap((record) => {
    const student = demoState.students.find(
      (candidate) => candidate.id === record.studentId,
    );
    if (!student) return [];
    return [
      {
        name: student.name,
        matric: student.matric,
        status: record.status,
        label: ATTENDANCE_STATUS_LABELS[record.status],
        flags: record.flags,
      },
    ];
  });
  const rosterRows = mock
    ? demoRosterRows
    : (liveData?.items ?? []).map((row) => ({
      name: row.display_name,
      matric: row.matric_no,
      status: row.status.toLowerCase(),
      label: getAttendanceStatusLabel(row.status),
        flags:
          row.classification === "verified" ||
          row.classification === "absent" ||
          row.classification === "excused"
            ? []
            : [getClassificationLabel(row.classification)],
      }));
  const webCheckins = mock
    ? demoRosterRows.length
    : (liveData?.counts.web_checkins ?? 0);
  const fingerprintScans = mock
    ? demoState.attendance.filter(
        (record) => record.sessionId === sessionId && record.scanTime !== "—",
      ).length
    : (liveData?.counts.scans ?? 0);
  const registeredStudents = mock
    ? demoState.students.length
    : (liveData?.counts.registered ?? 0);
  const offeringTitle = mock
    ? demoOffering?.title
    : apiOffering
      ? getOfferingLabel(apiOffering)
      : undefined;
  const offeringCode = mock ? demoOffering?.code : undefined;
  const venueName = mock ? demoSession?.venue : apiVenue?.name;
  const scannerStatusLabel =
    scannerStatus?.status === "online"
      ? "Scanner online"
      : scannerStatus?.status === "offline"
        ? "Scanner offline"
        : scannerStatus?.status === "no_scanner"
          ? "No scanner at this venue"
          : scannerStatusLoading
            ? "Checking scanner status…"
            : "Scanner status unavailable";
  const scannerStatusClass =
    scannerStatus?.status === "offline"
      ? "offline"
      : scannerStatus?.status === "online"
        ? "online"
        : "";
  const scannerLastSeen = scannerStatus?.last_seen_at
    ? `Last seen ${formatDate(scannerStatus.last_seen_at)}, ${formatTime(scannerStatus.last_seen_at)}`
    : "Last seen unavailable";
  // The geofence in force: the latest re-check result if there is one, then the
  // session the server returned. All three values may legitimately be absent.
  const geofence = locationResult ?? {
    latitude: apiSession?.latitude ?? null,
    longitude: apiSession?.longitude ?? null,
    radius_meters: apiSession?.radius_meters ?? null,
  };
  const hasGeofence =
    typeof geofence.latitude === "number" &&
    typeof geofence.longitude === "number";
  async function recalibrateVenue() {
    if (!venueId || recalibrating) return;
    setRecalibrating(true);
    setRecalibrateNote("");
    try {
      const fix = await tryGetCurrentPosition();
      if (!fix) {
        setRecalibrateNote(
          "This device could not provide a position, so nothing was changed.",
        );
        return;
      }
      const payload: CaptureVenueLocationRequest = {
        latitude: fix.lat,
        longitude: fix.lng,
        accuracy_meters: fix.accuracy,
      };
      const venue = await apiRequest<CaptureVenueLocationResponse>(
        `/venues/${encodeURIComponent(venueId)}/location`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setRecalibrateNote(
        `${venue.name} is now centred on this device's position.`,
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        const presentation = presentApiError(caught.code, caught.message);
        setRecalibrateNote(`${presentation.message} ${presentation.action}`);
      } else setRecalibrateNote(formatApiError(caught));
    } finally {
      setRecalibrating(false);
    }
  }
  useEffect(() => {
    if (!boardMode) return;
    let active = true;
    let acquired: { release: () => Promise<void> } | null = null;
    void requestScreenWakeLock()
      .then((lock) => {
        acquired = lock;
        if (!active && lock) void lock.release();
      })
      .catch(() => undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBoardMode(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      document.removeEventListener("keydown", onKeyDown);
      if (acquired) void acquired.release();
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => undefined);
    };
  }, [boardMode]);
  async function switchToFixedCode() {
    if (!sessionId) return;
    if (
      !window.confirm(
        "Switch permanently to a fixed check-in code? Rotating codes cannot be restored for this session.",
      )
    )
      return;
    try {
      const patch: SessionPatchRequest = { rotating: false };
      const fixed = await apiRequest<SessionPatchResponse>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );
      if (typeof fixed.code !== "string" || !fixed.code)
        throw new Error("The API did not return a fixed session code.");
      setLocalFixedCode(fixed.code);
    } catch (caught) {
      setNotice(formatApiError(caught));
    }
  }
  async function endSession() {
    if (!sessionId) return;
    if (
      !window.confirm(
        "End this attendance session? Students will no longer be able to check in.",
      )
    )
      return;
    try {
      await apiRequest<EndSessionResponse>(
        `/sessions/${encodeURIComponent(sessionId)}/end`,
        {
          method: "POST",
        },
      );
      forgetLiveSession(user.id, sessionId);
      setLocalEnded(true);
    } catch (caught) {
      setNotice(formatApiError(caught));
    }
  }
  function enterBoardMode() {
    setBoardMode(true);
    if (document.documentElement.requestFullscreen)
      void document.documentElement.requestFullscreen().catch(() => undefined);
  }
  function toggleProjectorMode() {
    const next = !projector;
    setProjector(next);
    if (next && document.documentElement.requestFullscreen)
      void document.documentElement
        .requestFullscreen()
        .catch(() => setProjectorUnavailable(true));
    else if (!next && document.fullscreenElement)
      void document.exitFullscreen().catch(() => setProjectorUnavailable(true));
  }
  if (boardMode)
    return (
      <section className={`board-mode ${boardTheme}`} aria-label="Board mode">
        <button
          className="board-close"
          onClick={() => setBoardMode(false)}
          aria-label="Exit board mode"
        >
          Exit
        </button>{" "}
        <button
          className="board-theme-toggle"
          onClick={() =>
            setBoardTheme(boardTheme === "dark" ? "light" : "dark")
          }
        >
          {boardTheme === "dark" ? "Light room" : "Dark room"}
        </button>{" "}
        <div className="board-content">
          <span className="board-kicker">CAMPUSCHECK · LIVE CLASS CODE</span>
          <h1>{offeringTitle ?? "Live attendance session"}</h1>
          <p className="board-venue">{venueName ?? "Session venue"}</p>
          <strong className="board-code">
            {`${activeCode.slice(0, 3)} ${activeCode.slice(3)}`}
          </strong>
          <div className="board-bottom">
            <span className="board-countdown">{fixedCode ? "—" : seconds}</span>
            <div className="board-stats">
              <span>
                <strong>{webCheckins}</strong>Web check-ins
              </span>
              <span>
                <strong>{fingerprintScans}</strong>Fingerprint scans
              </span>
              <span>
                <strong>{registeredStudents}</strong>Registered students
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  if (!sessionId)
    return (
      <div className="page-stack">
        <PageHeading
          eyebrow="LECTURER WORKSPACE"
          title="No session selected"
          subtitle="Start a session or open a live session to display its attendance code."
          action={
            <Link to="/lecturer/start" className="button primary-button">
              Start a session
            </Link>
          }
        />
      </div>
    );
  return (
    <div
      className={`page-stack ${projector ? `projector-mode ${boardTheme}` : ""}`}
    >
      <PageHeading
        eyebrow={`LIVE SESSION · ${offeringCode ?? "ATTENDANCE"}`}
        title={offeringTitle ?? "Live attendance session"}
        subtitle={venueName ?? `Session ${sessionId}`}
        action={
          <div className="live-actions">
            <button
              className="button secondary-button"
              onClick={enterBoardMode}
            >
              Board mode
            </button>
            <button
              className="button secondary-button"
              onClick={toggleProjectorMode}
            >
              {projector ? "Exit projector mode" : "Projector mode"}
            </button>
            {projector && (
              <button
                className="button secondary-button"
                onClick={() =>
                  setBoardTheme(boardTheme === "dark" ? "light" : "dark")
                }
              >
                {boardTheme === "dark" ? "Light room" : "Dark room"}
              </button>
            )}
          </div>
        }
      />
      {notice && (
        <div className="form-error" role="alert">
          {notice}
        </div>
      )}
      {liveError && (
        <div className="form-error" role="alert">
          {liveError}{" "}
          <button
            className="text-button"
            onClick={() => setReloadLiveKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {fixedCode && (
        <div className="fixed-code-banner">
          <b>Fixed code in use.</b> Read it out or write it on the board.
          Fingerprint checks matter more now.
        </div>
      )}
      {scannerOffline && (
        <div className="scanner-banner" role="status">
          Scanner offline from 09:31. Fingerprint results may be incomplete.
        </div>
      )}
      {projectorUnavailable && (
        <div className="scanner-banner" role="status">
          Projector unavailable. Board mode is ready on this device.
        </div>
      )}
      {startLocationSource && SESSION_LOCATION_NOTES[startLocationSource] && (
        <div className="form-info" role="status">
          {SESSION_LOCATION_NOTES[startLocationSource]}
        </div>
      )}
      <section className="panel live-dashboard">
        <div className="live-code-header">
          <span className="live-badge">
            <span /> SESSION LIVE
          </span>
          <div className="live-actions">
            {!fixedCode && (
              <button className="text-button" onClick={switchToFixedCode}>
                Switch to fixed code
              </button>
            )}
            <button className="text-button" onClick={endSession}>
              End session
            </button>
          </div>
        </div>
        {ended ? (
          <div className="ended-banner">
            Session ended. Attendance report is ready to view.
          </div>
        ) : (
          <div className="rotation-code">
            <span>STUDENT CHECK-IN CODE</span>
            <strong>
              {`${activeCode.slice(0, 3)} ${activeCode.slice(3)}`}
            </strong>
            {!fixedCode && (
              <div className="rotation-count">
                <span className="countdown-ring">{seconds}</span> Server refresh
                in {seconds}s
              </div>
            )}
            {codeError && (
              <p role="status" className="form-error">
                {codeError}
              </p>
            )}
          </div>
        )}
        <div className="live-stat-row">
          <div>
            <strong>{webCheckins}</strong>
            <span>Web check-ins</span>
          </div>
          <div>
            <strong>{fingerprintScans}</strong>
            <span>Fingerprint scans</span>
          </div>
          <div>
            <strong>{registeredStudents}</strong>
            <span>Students registered</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Venue scanner coverage</h2>
            <p>Scanner status reported by the API</p>
          </div>
          <span
            className={`scanner-pill ${scannerStatusClass}`}
          >
            <i />
            {scannerStatusLabel}
          </span>
        </div>
        <div className="scanner-coverage">
          <span
            className={`scanner-pill ${scannerStatusClass}`}
          >
            <i />
            {venueName ?? "Session venue"} · {scannerStatusLabel}
          </span>
          <span>{scannerLastSeen}</span>
          {scannerStatusError && (
            <p className="inline-error" role="status">
              {scannerStatusError}
            </p>
          )}
          {isMockMode() && (
            <select
              className="filter-select"
              aria-label="Mock live screen scenario"
              value={
                scannerOffline
                  ? "scanner_offline"
                  : projectorUnavailable
                    ? "projector_unavailable"
                    : ""
              }
              onChange={(event) => {
                const scenario = event.target.value;
                const offline = scenario === "scanner_offline";
                if (mock) setDemoScannerStatus(offline ? "offline" : "online");
                setProjectorUnavailable(scenario === "projector_unavailable");
              }}
            >
              <option value="">Mock scenarios</option>
              <option value="scanner_offline">Scanner offline</option>
              <option value="projector_unavailable">
                Projector unavailable
              </option>
            </select>
          )}
        </div>
      </section>
      {!ended && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Check-in area</h2>
              <p>
                Set from this device while the class runs; it stays with the
                room when you walk out
              </p>
            </div>
            {venueId && (
              <button
                className="button secondary-button"
                disabled={recalibrating}
                onClick={() => void recalibrateVenue()}
              >
                {recalibrating ? "Reading position…" : "Recalibrate this room"}
              </button>
            )}
          </div>
          <p>
            {hasGeofence
              ? `Centred on ${Number(geofence.latitude).toFixed(5)}, ${Number(
                  geofence.longitude,
                ).toFixed(5)}${
                  typeof geofence.radius_meters === "number"
                    ? ` · ${Math.round(geofence.radius_meters)} m radius`
                    : ""
                }`
              : "No check-in area for this class. Attendance works normally, and check-ins carry no distance."}
          </p>
          {locationNote && (
            <p className="field-note" role="status">
              {locationNote}
            </p>
          )}
          {recalibrateNote && (
            <p className="field-note" role="status">
              {recalibrateNote}
            </p>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Live roster</h2>
            <p>Attendance updates as students check in</p>
          </div>
          <Link
            to={`/lecturer/report?sessionId=${encodeURIComponent(sessionId)}`}
            className="text-button"
          >
            View full roster <Icon name="arrow" size={15} />
          </Link>
        </div>
        {liveLoading && !rosterRows.length ? (
          <p role="status">Loading session attendance…</p>
        ) : !rosterRows.length ? (
          <p className="empty-state">No attendance records are available for this session yet.</p>
        ) : rosterRows.map((row) => (
          <div className="roster-row" key={row.matric}>
            <span className="roster-avatar">{formatInitials(row.name)}</span>
            <div className="roster-person">
              <b>{row.name}</b>
              <span>{row.matric}</span>
            </div>
            <span className={`status-chip ${row.status}`}>
              <i />
              {row.label}
            </span>
            <span className="roster-flag">
              {row.flags.map(getReasonLabel).join(", ")}
            </span>
          </div>
        ))}
        {rosterRows.some((row) => row.flags.length > 0) && (
          <p className="field-note" role="status">
            Rows that need confirmation can be confirmed from the session report
            once this class ends.
          </p>
        )}
      </section>
    </div>
  );
}

export function Report({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const mock = isMockMode();
  const demoState = useDemoState(mock);
  const [searchParams] = useSearchParams();
  const sessionReports = getRememberedSessionReports(user.id);
  const [filter, setFilter] = useState("All statuses");
  const [department, setDepartment] = useState("All departments");
  const [selected, setSelected] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reasonType, setReasonType] =
    useState<AttendanceOverrideRequest["reason_code"]>("power_outage");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] =
    useState<AttendanceOverrideRequest["status"]>("present");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [reportData, setReportData] = useState<SessionReportResponse | null>(
    null,
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reloadReportKey, setReloadReportKey] = useState(0);
  const sessionId =
    searchParams.get("sessionId") ??
    sessionReports[0]?.sessionId ??
    (mock
      ? (demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : "");
  useEffect(() => {
    if (mock) return;
    let active = true;
    setReportData(null);
    setReportLoading(true);
    setReportError("");
    if (!sessionId) {
      setReportError("Open a session report from a session.");
      setReportLoading(false);
      return;
    }
    void getAllSessionReportRows(sessionId)
      .then((result) => {
        if (active) setReportData(result);
      })
      .catch((caught: unknown) => {
        if (active) setReportError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mock, reloadReportKey, sessionId]);
  const scannerOffline = mock
    ? demoState.scanners.some((scanner) => scanner.status === "offline")
    : reportData?.scanner_coverage.state === "none" ||
      reportData?.scanner_coverage.state === "partial";
  const demoRows = demoState.attendance
    .filter((record) => record.sessionId === sessionId)
    .flatMap((record) => {
    const student = demoState.students.find(
      (candidate) => candidate.id === record.studentId,
    );
    if (!student) return [];
    return [
      {
        id: student.id,
        name: student.name,
        matric: student.matric,
        department: student.department,
        web: record.webTime,
        scan: record.scanTime,
        status: getDemoAttendanceStatus(record.status),
        attendanceLabel: getAttendanceStatusLabel(
          getDemoAttendanceStatus(record.status),
        ),
        classificationClass:
          record.status === "needs_confirmation" || record.status === "late"
            ? "web_only_unverified"
            : record.status === "scan_only"
              ? "scan_only"
              : record.status,
        label: getDemoClassificationLabel(record.status),
        flags: record.flags,
      },
    ];
  });
  const rows: ReportDisplayRow[] = mock
    ? demoRows
    : (reportData?.items ?? []).map((item) => ({
        id: item.student_record_id,
        name: item.display_name,
        matric: item.matric_no,
        department: item.department_id,
        web: "—",
        scan: "—",
        status: item.status.toLowerCase(),
        attendanceLabel: getAttendanceStatusLabel(item.status),
        classificationClass: getClassificationClass(item.classification),
        label: getClassificationLabel(item.classification),
        flags: item.reason ? [item.reason] : [],
      }));
  const registeredCount = rows.length;
  const verifiedCount = rows.filter((row) => row.label === "Verified").length;
  const needsConfirmationCount = rows.filter(
    (row) => row.label === "Needs confirmation",
  ).length;
  const proxyCount = rows.filter(
    (row) => row.label === "Needs review (proxy)",
  ).length;
  const scanOnlyCount = rows.filter((row) => row.label === "Scan only").length;
  const absentCount = rows.filter((row) => row.status === "absent").length;
  const needsReviewCount = rows.filter(
    (row) =>
      row.label === "Needs confirmation" ||
      row.label === "Needs review (proxy)" ||
      row.label === "Scan only",
  ).length;
  const departments = [...new Set(rows.map((row) => row.department))];
  const filteredRows = rows.filter(
    (row) =>
      (filter === "All statuses" ||
        (filter === "Late"
          ? row.status === "late"
          : row.label === filter)) &&
      (department === "All departments" || row.department === department),
  );
  async function exportReport(format: "csv" | "pdf") {
    setExporting(true);
    setMessage("");
    try {
      if (!sessionId) throw new Error("Open a session report from a session.");
      if (!mock) {
        await downloadApiFile(
          `/sessions/${encodeURIComponent(sessionId)}/report?format=${format}`,
          `session-${sessionId}-report.${format}`,
        );
      } else if (format === "pdf") {
        window.print();
        setMessage("Use the print dialog to save this report as a PDF.");
      } else {
        setMessage(
          "Report CSV is ready to download when the API is connected.",
        );
      }
    } catch (caught) {
      setMessage(formatApiError(caught));
    } finally {
      setExporting(false);
    }
  }
  async function submitOverride() {
    if (saving || (reasonType === "other" && !reason.trim())) return;
    if (!sessionId) {
      setMessage("Open a session report from a session before overriding records.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload: AttendanceOverrideRequest = {
        student_ids: selectedIds.length ? selectedIds : [selected],
        status: newStatus,
        reason_code: reasonType,
        note: reasonType === "other" ? reason : undefined,
      };
      const results = mock
        ? {
            results: payload.student_ids.map((studentId) => ({
              student_id: studentId,
              applied: true,
              error_code: undefined,
            })),
          }
        : await apiRequest<BulkOverrideResponse>(
            `/sessions/${encodeURIComponent(sessionId)}/overrides/bulk`,
            {
            method: "POST",
            body: JSON.stringify(payload),
            },
          );
      setMessage(
        results.results
          .map(
            (result) =>
              `${result.student_id}: ${result.applied ? "saved" : `not saved${result.error_code ? ` (${result.error_code})` : ""}`}`,
          )
          .join(" · "),
      );
      if (mock)
        overrideDemoAttendance(
          sessionId,
          payload.student_ids,
          payload.status === "present" ? "verified" : payload.status,
          reasonType === "other" ? reason : reasonType,
        );
      else setReloadReportKey((key) => key + 1);
      setSelected("");
      setSelectedIds([]);
      setBulkOpen(false);
      setReason("");
    } catch (caught) {
      setMessage(formatApiError(caught));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SESSION REPORT"
        title="Session report"
        subtitle={sessionId ? `Session ${sessionId}` : "No session selected"}
        action={
          <div className="report-actions">
            <Link
              to={`/lecturer/print-sheet?sessionId=${encodeURIComponent(sessionId)}`}
              className="button secondary-button"
            >
              Print attendance sheet
            </Link>
            <button
              className="button secondary-button"
              disabled={exporting}
              onClick={() => void exportReport("csv")}
            >
              {exporting ? "Preparing…" : "Export CSV"}{" "}
              <Icon name="arrow" size={15} />
            </button>
            <button
              className="button secondary-button"
              disabled={exporting || !sessionId}
              onClick={() => void exportReport("pdf")}
            >
              {exporting ? "Preparing…" : "Export PDF"}{" "}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        }
      />
      {sessionReports.length > 1 && (
        <label className="field-label">
          Choose a session report
          <select
            className="field-control"
            aria-label="Choose a session report"
            value={sessionId}
            onChange={(event) =>
              navigate(
                `/lecturer/report?sessionId=${encodeURIComponent(event.target.value)}`,
              )
            }
          >
            {sessionReports.map((report) => (
              <option key={report.sessionId} value={report.sessionId}>
                {report.offeringLabel} ·{" "}
                {new Date(report.startedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </option>
            ))}
          </select>
        </label>
      )}
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      {reportError && (
        <div className="form-error" role="alert">
          {reportError}{" "}
          <button
            className="text-button"
            onClick={() => setReloadReportKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className="report-summary">
        <span className="summary-kicker">SESSION RESULTS</span>
        <b>
          {registeredCount} <small>students on report</small>
        </b>
        <span>
          {verifiedCount} verified <i>·</i> {needsReviewCount} need review
        </span>
      </div>
      {needsConfirmationCount > 0 && (
        <div className="form-info" role="status">
          {needsConfirmationCount} record
          {needsConfirmationCount === 1 ? "" : "s"} need confirmation. Each one
          passed a live code and the one-student-per-device check; the scanner,
          or the position, could not corroborate it. Confirm or correct them
          with an override.
        </div>
      )}
      {proxyCount > 0 && (
        <div className="form-info" role="status">
          {proxyCount} record{proxyCount === 1 ? "" : "s"}{" "}
          {proxyCount === 1 ? "has" : "have"} a proxy classification and need
          review. This classification is not confirmed presence; the attendance
          status shown below is reported separately by the backend.
        </div>
      )}
      <div className="report-stat-grid">
        {[
          [String(verifiedCount), "Verified", "Verified attendance", "verified"],
          [
            String(needsConfirmationCount),
            "Needs confirmation",
            "Confirm or clear these once the class has ended",
            "needs-confirmation",
          ],
          [
            String(proxyCount),
            "Needs review (proxy)",
            "Review this backend classification; it is not confirmed presence",
            "needs-confirmation",
          ],
          [String(scanOnlyCount), "Scan only", "Scan recorded without web check-in", "info"],
          [String(absentCount), "Absent", "No attendance recorded", "absent"],
        ].map((item) => (
          <div className={`panel report-stat ${item[3]}`} key={item[1]}>
            <span className="report-stat-icon">
              <i />
            </span>
            <b>{item[0]}</b>
            <strong>{item[1]}</strong>
            <span>{item[2]}</span>
          </div>
        ))}
      </div>
      {scannerOffline && (
        <div className="scanner-banner" role="status">
          Scanner coverage: {reportData?.scanner_coverage.state ?? "offline"}.
          Fingerprint results may be incomplete.
          Web-only statuses are displayed exactly as returned by the API.
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance record</h2>
            <p>API-classified results · {registeredCount} students on this roster</p>
          </div>
          <div className="report-filters">
            {isMockMode() && (
              <select
                className="filter-select"
                aria-label="Mock report scanner scenario"
                value={scannerOffline ? "scanner_offline" : ""}
                onChange={(event) => {
                  const offline = event.target.value === "scanner_offline";
                  if (mock)
                    setDemoScannerStatus(offline ? "offline" : "online");
                }}
              >
                <option value="">Scanner online</option>
                <option value="scanner_offline">Scanner offline</option>
              </select>
            )}
            <label className="department-filter">
              Department{" "}
              <select
                className="filter-select"
                aria-label="Filter by department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              >
                <option>All departments</option>
                {departments.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="status-filters" aria-label="Filter attendance statuses">
          {[
            "All statuses",
            "Verified",
            "Needs confirmation",
            "Needs review (proxy)",
            "Scan only",
            "Absent",
            "Late",
            "Excused",
          ].map((status) => (
            <button
              key={status}
              className={`filter-chip ${filter === status ? "active" : ""}`}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="bulk-controls">
          <label className="bulk-select">
            <input
              className="bulk-row-check"
              type="checkbox"
              aria-label="Select all visible students"
              checked={
                filteredRows.length > 0 &&
                filteredRows.every((row) => selectedIds.includes(row.id))
              }
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? filteredRows.map((row) => row.id) : [],
                )
              }
            />{" "}
            Select visible students
          </label>
          <button
            className="button secondary-button"
            disabled={!selectedIds.length}
            onClick={() => setBulkOpen(true)}
          >
            Override selected ({selectedIds.length})
          </button>
        </div>
        {reportLoading ? (
          <p role="status">Loading session report…</p>
        ) : !rows.length ? (
          <p className="empty-state">No attendance report records are available for this session.</p>
        ) : <><div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col">Student</th>
                <th scope="col">Matric</th>
                <th scope="col">Department</th>
                <th scope="col">Web time</th>
                <th scope="col">Scan time</th>
                <th scope="col">Attendance status</th>
                <th scope="col">Classification</th>
                <th scope="col">Reason</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className="bulk-row-check"
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked
                            ? [...selectedIds, row.id]
                            : selectedIds.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td>{row.matric}</td>
                  <td>{row.department}</td>
                  <td>{row.web}</td>
                  <td>{row.scan}</td>
                  <td>
                    <span className={`status-chip ${row.status}`}>
                      <i />
                      {row.attendanceLabel}
                    </span>
                  </td>
                  <td>
                    <span className={`status-chip ${row.classificationClass}`}>
                      <i />
                      {row.label}
                    </span>
                  </td>
                  <td>
                    <div className="flag-list">
                      {row.flags.length ? (
                        row.flags.map((flag) => (
                          <span className="flag-pill" key={flag}>
                            {getReasonLabel(flag)}
                          </span>
                        ))
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelected(row.id);
                        setSelectedIds([]);
                      }}
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.map((row) => (
          <article className="report-mobile-card" key={`mobile-${row.id}`}>
            <div className="report-mobile-heading">
              <label className="bulk-select">
                <input
                  className="bulk-row-check"
                  type="checkbox"
                  aria-label={`Select ${row.name}`}
                  checked={selectedIds.includes(row.id)}
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked
                        ? [...selectedIds, row.id]
                        : selectedIds.filter((id) => id !== row.id),
                    )
                  }
                />
                <b>{row.name}</b>
              </label>
              <span className={`status-chip ${row.status}`}>
                <i />
                {row.attendanceLabel}
              </span>
              <span className={`status-chip ${row.classificationClass}`}>
                <i />
                {row.label}
              </span>
            </div>
            <span className="report-mobile-matric">
              {row.matric} · {row.department}
            </span>
            <div className="report-mobile-details">
              <span>Web: {row.web}</span>
              <span>Scan: {row.scan}</span>
            </div>
            <div className="flag-list">
              {row.flags.map((flag) => (
                <span className="flag-pill" key={flag}>
                  {getReasonLabel(flag)}
                </span>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setSelected(row.id);
                setSelectedIds([]);
              }}
            >
              Override record
            </button>
          </article>
        ))}
        </>}
      </section>
      {(selected || bulkOpen) && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="override-title"
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => {
                setSelected("");
                setBulkOpen(false);
              }}
            >
              ×
            </button>
            <h2 id="override-title">
              {bulkOpen
                ? `Override ${selectedIds.length} records?`
                : `Review ${rows.find((row) => row.id === selected)?.name ?? "student"}'s record`}
            </h2>
            <p>
              This change will be recorded in the audit trail.{" "}
              {bulkOpen
                ? `You selected ${selectedIds.length} students. Confirm that count before submitting.`
                : "Choose a status and reason for this student."}
            </p>
            <label className="field-label" htmlFor="override-status">
              New attendance status
            </label>
            <select
              className="field-control"
              id="override-status"
              value={newStatus}
              onChange={(event) => {
                const value = event.target.value;
                if (isOverrideStatus(value)) setNewStatus(value);
              }}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
            <label className="field-label" htmlFor="override-reason-type">
              Reason
            </label>
            <select
              className="field-control"
              id="override-reason-type"
              value={reasonType}
              onChange={(event) => {
                const value = event.target.value;
                if (isOverrideReason(value)) setReasonType(value);
              }}
            >
              <option value="power_outage">Power outage</option>
              <option value="device_failure">Device failure</option>
              <option value="official_duty">Official duty</option>
              <option value="medical">Medical</option>
              <option value="other">Other</option>
            </select>
            {reasonType === "other" && (
              <>
                <label className="field-label" htmlFor="override-reason">
                  Explain why (required)
                </label>
                <textarea
                  className="field-control"
                  id="override-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain why this record needs to change…"
                />
              </>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary-button"
                onClick={() => {
                  setSelected("");
                  setBulkOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                disabled={saving || (reasonType === "other" && !reason.trim())}
                onClick={() => void submitOverride()}
              >
                {saving ? "Saving…" : "Confirm audited change"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function PrintSheet() {
  const mock = isMockMode();
  const demoState = useDemoState(mock);
  const [searchParams] = useSearchParams();
  const sessionId =
    searchParams.get("sessionId") ??
    (mock
      ? (demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : "");
  const [apiRows, setApiRows] = useState<RosterSheetRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!mock);
  const [exportingPdf, setExportingPdf] = useState(false);
  const rows = mock
    ? demoState.students.map((student) => ({
        display_name: student.name,
        matric_no: student.matric,
      }))
    : apiRows.map((row) => ({
        display_name: row.display_name,
        matric_no: row.matric_no,
      }));
  useEffect(() => {
    if (mock) return;
    if (!sessionId) {
      setError("Open the print sheet from a session.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void apiRequest<RosterPage>(
      `/sessions/${encodeURIComponent(sessionId)}/roster-sheet`,
    )
      .then((result) => {
        if (!cancelled) setApiRows(result.items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(formatApiError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mock, sessionId]);
  async function exportPdf() {
    if (!sessionId) {
      setError("Open the PDF export from a session.");
      return;
    }
    if (mock) {
      window.print();
      return;
    }
    setExportingPdf(true);
    setError("");
    try {
      await downloadApiFile(
        `/sessions/${encodeURIComponent(sessionId)}/roster-sheet?format=pdf`,
        `session-${sessionId}-roster.pdf`,
      );
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setExportingPdf(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SESSION ROSTER"
        title="Paper attendance sheet"
        subtitle={
          sessionId
            ? `Session ${sessionId} · signature roster`
            : "Select a session to view its roster."
        }
        action={
          <div className="button-row">
            <button
              className="button secondary-button"
              disabled={exportingPdf || !sessionId}
              onClick={() => void exportPdf()}
            >
              {exportingPdf ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              className="button primary-button"
              disabled={loading || !rows.length}
              onClick={() => window.print()}
            >
              Print sheet
            </button>
          </div>
        }
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <section className="print-sheet panel">
        <h1>CampusCheck · Attendance register</h1>
        <p>{sessionId ? `Session ${sessionId}` : "No session selected"}</p>
        {loading ? (
          <p role="status">Loading session roster…</p>
        ) : rows.length ? <table>
          <thead>
            <tr>
              <th>Student name</th>
              <th>Matric number</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.matric_no}>
                <td>{row.display_name}</td>
                <td>{row.matric_no}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table> : <p className="empty-state">No roster records are available for this session.</p>}
      </section>
    </div>
  );
}
