import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, downloadApiFile } from "@/shared/lib/apiClient";
import { useServerCode } from "@/shared/hooks/useServerCode";
import { requestScreenWakeLock } from "@/shared/lib/wakeLock";
import { formatInitials } from "@/shared/lib/format";
import { ApiError, formatApiError } from "@/api/errors";
import type {
  AttendanceOverrideRequest,
  BulkOverrideResponse,
  CurrentUser,
  EndSessionResponse,
  OfferingsResponse,
  RosterPage,
  RosterSheetRow,
  StartSessionRequest,
  StartSessionResponse,
  SessionPatchRequest,
  SessionPatchResponse,
  VenueListResponse,
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

const ATTENDANCE_STATUS_LABELS: Record<DemoAttendance["status"], string> = {
  verified: "Verified",
  suspected_proxy: "Suspected proxy",
  scan_only: "Scan only",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

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

export function Teaching({ user }: { user: CurrentUser }) {
  const [offerings, setOfferings] =
    useState<OfferingsResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
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
                <span>Assigned to your lecturer account</span>
              </div>
              <Link
                to={`/lecturer/start?offeringId=${encodeURIComponent(offering.id)}`}
                className="text-button"
                aria-label={`Start ${getOfferingLabel(offering)} session`}
              >
                Start session <Icon name="arrow" size={15} />
              </Link>
            </div>
          ))
        ) : (
          <p className="empty-state">
            No offerings are assigned to your lecturer account.
          </p>
        )}
      </section>
    </div>
  );
}

export function StartSession() {
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
    const payload: StartSessionRequest = {
      offering_id: offeringId,
      venue_id: venueId,
      rotating_code: rotatingCode,
      late_after_min: lateAfterMin,
    };
    try {
      const result = await apiRequest<StartSessionResponse>("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      navigate(
        `/lecturer/live?sessionId=${encodeURIComponent(result.session.id)}`,
      );
    } catch (caught) {
      setError(formatApiError(caught));
      setFieldErrors(getFieldErrors(caught));
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
            <button
              className="button primary-button"
              type="submit"
              disabled={saving || !offeringId || !venueId}
            >
              {saving ? "Starting session…" : "Start session"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export function LiveSession() {
  const mock = isMockMode();
  const demoState = useDemoState();
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");
  const sessionId =
    requestedSessionId ??
    (mock
      ? (demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : "");
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
  const [localScannerOffline, setLocalScannerOffline] = useState(false);
  const [projectorUnavailable, setProjectorUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const fixedCode =
    localFixedCode ??
    (mock && demoSession && !demoSession.rotating ? demoSession.code : null);
  const ended = localEnded || (mock && demoSession?.state === "ended");
  const scannerOffline = mock
    ? demoState.scanners.some((scanner) => scanner.status === "offline")
    : localScannerOffline;
  const {
    code,
    seconds,
    error: codeError,
  } = useServerCode(
    sessionId,
    Boolean(
      sessionId &&
        !ended &&
        !fixedCode &&
        (!mock || demoSession?.rotating !== false),
    ),
  );
  const activeCode = fixedCode ?? code;
  const rosterRows = demoState.attendance.flatMap((record) => {
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
          <h1>{demoOffering?.title ?? "Live attendance session"}</h1>
          <p className="board-venue">{demoSession?.venue ?? "Session venue"}</p>
          <strong className="board-code">
            {`${activeCode.slice(0, 3)} ${activeCode.slice(3)}`}
          </strong>
          <div className="board-bottom">
            <span className="board-countdown">{fixedCode ? "—" : seconds}</span>
            <div className="board-stats">
              <span>
                <strong>142</strong>Web check-ins
              </span>
              <span>
                <strong>12</strong>Fingerprint scans
              </span>
              <span>
                <strong>184</strong>Registered students
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
        eyebrow={`LIVE SESSION · ${demoOffering?.code ?? "ATTENDANCE"}`}
        title={demoOffering?.title ?? "Live attendance session"}
        subtitle={demoSession?.venue ?? "Session venue"}
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
            <strong>142</strong>
            <span>Web check-ins</span>
          </div>
          <div>
            <strong>12</strong>
            <span>Fingerprint scans</span>
          </div>
          <div>
            <strong>184</strong>
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
            className={`scanner-pill ${scannerOffline ? "offline" : "online"}`}
          >
            <i />
            {scannerOffline ? "Scanner offline" : "All scanners online"}
          </span>
        </div>
        <div className="scanner-coverage">
          <span
            className={`scanner-pill ${scannerOffline ? "offline" : "online"}`}
          >
            <i />
            Lecture Theatre 2 · {scannerOffline ? "Offline" : "Online"}
          </span>
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
                setLocalScannerOffline(offline);
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
        {rosterRows.map((row) => (
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
            <span className="roster-flag">{row.flags.join(", ")}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export function Report() {
  const demoState = useDemoState();
  const [searchParams] = useSearchParams();
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
  const [localScannerOffline, setLocalScannerOffline] = useState(false);
  const [message, setMessage] = useState("");
  const mock = isMockMode();
  const sessionId =
    searchParams.get("sessionId") ??
    (mock
      ? (demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : "");
  const scannerOffline = mock
    ? demoState.scanners.some((scanner) => scanner.status === "offline")
    : localScannerOffline;
  const rows = demoState.attendance.flatMap((record) => {
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
        status: record.status,
        label: ATTENDANCE_STATUS_LABELS[record.status],
        flags: record.flags,
      },
    ];
  });
  const filteredRows = rows.filter(
    (row) =>
      (filter === "All statuses" || row.label === filter) &&
      (department === "All departments" || row.department === department),
  );
  async function exportReport() {
    setExporting(true);
    setMessage("");
    try {
      if (!sessionId) throw new Error("Open a session report from a session.");
      if (!mock)
        await downloadApiFile(
          `/sessions/${encodeURIComponent(sessionId)}/report?format=csv`,
          "ENG-301-session-report.csv",
        );
      else
        setMessage(
          "Report CSV is ready to download when the API is connected.",
        );
    } catch {
      setMessage("The report couldn't be downloaded. Please try again.");
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
      setSelected("");
      setSelectedIds([]);
      setBulkOpen(false);
      setReason("");
    } catch {
      setMessage("The attendance changes were not saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SESSION REPORT · ENG 301"
        title="Session report"
        subtitle="Engineering Mathematics III · Monday, 17 February 2025 · Lecture Theatre 2"
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
              onClick={() => void exportReport()}
            >
              {exporting ? "Preparing…" : "Export CSV"}{" "}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        }
      />
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      <div className="report-summary">
        <span className="summary-kicker">SESSION RESULTS</span>
        <b>
          184 <small>registered students</small>
        </b>
        <span>
          142 web check-ins <i>·</i> 12 fingerprint scans <i>·</i> 30 need
          review
        </span>
      </div>
      <div className="report-stat-grid">
        {[
          ["142", "Verified", "Web and fingerprint confirmed", "verified"],
          ["9", "Suspected proxy", "Flagged for lecturer review", "suspected"],
          ["12", "Scan only", "Fingerprint scan, no web log", "info"],
          ["21", "Absent", "No attendance recorded", "absent"],
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
          Scanner offline from 09:31. Fingerprint results may be incomplete.
          Web-only statuses are displayed exactly as returned by the API.
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance record</h2>
            <p>API-classified results · 184 students on this roster</p>
          </div>
          <div className="report-filters">
            {isMockMode() && (
              <select
                className="filter-select"
                aria-label="Mock report scanner scenario"
                value={scannerOffline ? "scanner_offline" : ""}
                onChange={(event) => {
                  const offline = event.target.value === "scanner_offline";
                  setLocalScannerOffline(offline);
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
                <option>Computer Engineering</option>
                <option>Electrical Engineering</option>
              </select>
            </label>
          </div>
        </div>
        <div className="status-filters" aria-label="Filter attendance statuses">
          {[
            "All statuses",
            "Verified",
            "Suspected proxy",
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
        <div className="report-table-scroll">
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
                <th scope="col">Status</th>
                <th scope="col">Flags</th>
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
                      {row.label}
                    </span>
                  </td>
                  <td>
                    <div className="flag-list">
                      {row.flags.length ? (
                        row.flags.map((flag) => (
                          <span className="flag-pill" key={flag}>
                            {flag}
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
                  {flag}
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
  const demoState = useDemoState();
  const [searchParams] = useSearchParams();
  const mock = isMockMode();
  const sessionId =
    searchParams.get("sessionId") ??
    (mock
      ? (demoState.sessions.find((session) => session.state === "live")?.id ??
        "")
      : "");
  const [apiRows, setApiRows] = useState<RosterSheetRow[]>([]);
  const [error, setError] = useState("");
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
      return;
    }
    let cancelled = false;
    void apiRequest<RosterPage>(
      `/sessions/${encodeURIComponent(sessionId)}/roster-sheet`,
    )
      .then((result) => {
        if (!cancelled) setApiRows(result.items);
      })
      .catch(() => {
        if (!cancelled)
          setError("The roster sheet couldn't be loaded. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [mock, sessionId]);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SESSION REPORT · ENG 301"
        title="Paper attendance sheet"
        subtitle="Print this roster for signature-based attendance during a power or scanner outage."
        action={
          <button
            className="button primary-button"
            onClick={() => window.print()}
          >
            Print sheet
          </button>
        }
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <section className="print-sheet panel">
        <h1>CampusCheck · Attendance register</h1>
        <p>
          Engineering Mathematics III · ENG 301 · 17 February 2025 · Engineering
          Building, Lecture Theatre 2
        </p>
        <table>
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
        </table>
      </section>
    </div>
  );
}
