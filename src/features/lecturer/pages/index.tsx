import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, downloadApiFile } from "@/shared/lib/apiClient";
import { useServerCode } from "@/shared/hooks/useServerCode";
import { requestScreenWakeLock } from "@/shared/lib/wakeLock";
import { formatInitials } from "@/shared/lib/format";
import type {
  AttendanceOverrideRequest,
  BulkOverrideResponse,
  RosterSheetRow,
  SessionPatchRequest,
  SessionPatchResponse,
} from "@/api/contracts";
import {
  Icon,
  isOverrideReason,
  isOverrideStatus,
  LIVE_CLASS,
  PageHeading,
} from "@/shared/ui/primitives";
import {
  overrideDemoAttendance,
  setDemoScannerStatus,
  setDemoSessionFixedCode,
  updateDemoState,
  type DemoAttendance,
} from "@/mocks/store";
import { useDemoState } from "@/mocks/useDemoState";

const ATTENDANCE_STATUS_LABELS: Record<DemoAttendance["status"], string> = {
  verified: "Verified",
  suspected_proxy: "Suspected proxy",
  scan_only: "Scan only",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export function Teaching() {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="LECTURER WORKSPACE"
        title="Good morning, Dr. Eze"
        subtitle="Your classes are ready. Start a session when your students arrive."
        action={
          <Link to="/lecturer/live" className="button primary-button">
            <Icon name="calendar" /> Start a session
          </Link>
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Today's teaching</h2>
            <p>Monday, 17 February · 3 offerings</p>
          </div>
        </div>
        {[
          "Human Computer Interaction · CSC 342",
          "Database Management · CSC 326",
          "Software Engineering · CSC 318",
        ].map((item, i) => (
          <div className="teaching-row" key={item}>
            <span className="teaching-time">
              {["9:00 AM", "11:00 AM", "1:00 PM"][i]}
            </span>
            <div>
              <b>{item}</b>
              <span>
                {
                  [
                    "New Science · LT 2",
                    "ICT Building · Room 14",
                    "New Science · LT 1",
                  ][i]
                }
              </span>
            </div>
            <Link to="/lecturer/live" className="text-button">
              {i === 0 ? "View live session" : "Start session"}{" "}
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LiveSession() {
  const mock =
    import.meta.env.DEV &&
    (import.meta.env.MODE === "mock" ||
      import.meta.env.VITE_USE_MOCKS === "true");
  const demoState = useDemoState();
  const demoSession = demoState.sessions.find(
    (session) => session.id === "demo-session",
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
    "demo-session",
    !fixedCode && (!mock || demoSession?.rotating !== false),
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
    if (
      !window.confirm(
        "Switch permanently to a fixed check-in code? Rotating codes cannot be restored for this session.",
      )
    )
      return;
    try {
      const patch: SessionPatchRequest = { rotating: false };
      const fixed = mock
        ? { code }
        : await apiRequest<SessionPatchResponse>("/sessions/demo-session", {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
      if (typeof fixed.code !== "string" || !fixed.code)
        throw new Error("The API did not return a fixed session code.");
      setLocalFixedCode(fixed.code);
      if (mock) setDemoSessionFixedCode(fixed.code);
    } catch {
      setNotice(
        "The session could not be switched to fixed code. Please try again.",
      );
    }
  }
  async function endSession() {
    if (
      !window.confirm(
        "End this attendance session? Students will no longer be able to check in.",
      )
    )
      return;
    try {
      if (!mock)
        await apiRequest<unknown>("/sessions/demo-session/end", {
          method: "POST",
        });
      setLocalEnded(true);
      if (mock)
        updateDemoState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === "demo-session"
              ? { ...session, state: "ended" }
              : session,
          ),
        }));
    } catch {
      setNotice("The session could not be ended. Please try again.");
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
          <h1>
            {LIVE_CLASS.title} · {LIVE_CLASS.code}
          </h1>
          <p className="board-venue">
            Engineering Building · Lecture Theatre 2
          </p>
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
  return (
    <div
      className={`page-stack ${projector ? `projector-mode ${boardTheme}` : ""}`}
    >
      <PageHeading
        eyebrow={`LIVE SESSION · ${LIVE_CLASS.code}`}
        title={LIVE_CLASS.title}
        subtitle="Engineering Building · Lecture Theatre 2"
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
          {import.meta.env.DEV && (
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
          <Link to="/lecturer/report" className="text-button">
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
  const [filter, setFilter] = useState("All statuses");
  const [department, setDepartment] = useState("All departments");
  const [selected, setSelected] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reasonType, setReasonType] =
    useState<AttendanceOverrideRequest["reason"]>("power_outage");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] =
    useState<AttendanceOverrideRequest["status"]>("verified");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [localScannerOffline, setLocalScannerOffline] = useState(false);
  const [message, setMessage] = useState("");
  const mock =
    import.meta.env.DEV &&
    (import.meta.env.MODE === "mock" ||
      import.meta.env.VITE_USE_MOCKS === "true");
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
      if (!mock)
        await downloadApiFile(
          "/sessions/demo-session/report.csv",
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
    setSaving(true);
    setMessage("");
    try {
      const payload: AttendanceOverrideRequest = {
        student_ids: selectedIds.length > 1 ? selectedIds : [selected],
        status: newStatus,
        reason: reasonType,
        reason_text: reasonType === "other" ? reason : undefined,
      };
      if (selectedIds.length > 1) {
        const results = mock
          ? {
              results: selectedIds.map((studentId) => ({
                student_id: studentId,
                success: true,
              })),
            }
          : await apiRequest<BulkOverrideResponse>(
              "/sessions/demo-session/overrides/bulk",
              {
                method: "POST",
                body: JSON.stringify(payload),
              },
            );
        setMessage(
          results.results
            .map(
              (result) =>
                `${result.student_id}: ${result.success ? "saved" : "not saved"}`,
            )
            .join(" · "),
        );
      } else {
        if (!mock)
          await apiRequest<unknown>("/sessions/demo-session/overrides", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        setMessage("The record was saved and added to the audit trail.");
      }
      if (mock)
        overrideDemoAttendance(
          payload.student_ids,
          payload.status,
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
              to="/lecturer/print-sheet"
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
            {import.meta.env.DEV && (
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
              <option value="verified">Verified</option>
              <option value="suspected_proxy">Suspected proxy</option>
              <option value="scan_only">Scan only</option>
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
  const mock =
    import.meta.env.DEV &&
    (import.meta.env.MODE === "mock" ||
      import.meta.env.VITE_USE_MOCKS === "true");
  const [apiRows, setApiRows] = useState<RosterSheetRow[]>([]);
  const [error, setError] = useState("");
  const rows = mock
    ? demoState.students.map((student) => ({
        name: student.name,
        matric_number: student.matric,
      }))
    : apiRows;
  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    void apiRequest<RosterSheetRow[]>("/sessions/demo-session/roster-sheet")
      .then((result) => {
        if (!cancelled) setApiRows(result);
      })
      .catch(() => {
        if (!cancelled)
          setError("The roster sheet couldn't be loaded. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [mock]);
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
              <tr key={row.matric_number}>
                <td>{row.name}</td>
                <td>{row.matric_number}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
