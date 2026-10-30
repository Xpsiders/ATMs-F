import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "@/shared/lib/apiClient";
import { ApiError, formatApiError, presentApiError } from "@/api/errors";
import { getDeviceHash } from "@/shared/lib/deviceHash";
import { formatTime } from "@/shared/lib/format";
import {
  getCurrentPosition,
  GeoError,
  type Coordinates,
} from "@/shared/lib/geo";
import type {
  CheckInRequest,
  CheckInResponse,
  DepartmentCatalogueResponse,
  LiveClass,
  LiveClassesResponse,
  OfferingsResponse,
  PendingRegistrationsResponse,
  RegistrationResponse,
  SearchOffering,
  SearchOfferingsQuery,
  SearchOfferingsResponse,
  StudentAttendanceEntry,
  StudentAttendanceResponse,
  StudentCoursesResponse,
  StudentTimetableResponse,
} from "@/api/contracts";
import { isMockMode } from "@/mocks/auth";
import { useApiResource } from "@/features/student/hooks/useApiResource";
import {
  CHECKIN_ERRORS,
  Icon,
  PageHeading,
} from "@/shared/ui/primitives";

export function Dashboard() {
  const live = useApiResource<LiveClassesResponse>("/me/live-classes");
  const timetable = useApiResource<StudentTimetableResponse>("/me/timetable");
  const courses = useApiResource<StudentCoursesResponse>("/me/courses");
  const now = new Date();
  const currentMinutes = getCurrentCampusMinutes(now);
  const laterToday =
    timetable.data?.items.filter((item) => {
      const startsAt = getCampusMinutesFromTime(item.starts_at);
      return !item.live_now && startsAt !== null && startsAt > currentMinutes;
    }) ?? [];

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={new Intl.DateTimeFormat(undefined, {
          timeZone: "Africa/Lagos",
          dateStyle: "full",
        })
          .format(now)
          .toUpperCase()}
        title="Your day at a glance"
        subtitle="Your live classes, today's timetable, and attendance at a glance."
        action={
          <Link className="button primary-button" to="/check-in">
            <Icon name="pin" size={17} /> Check in to class
          </Link>
        }
      />
      <div className="summary-strip">
        <div className="summary-item">
          <span className="summary-icon blue-tint">
            <Icon name="calendar" />
          </span>
          <div>
            <span>Classes today</span>
            <strong>
              {timetable.loading ? "…" : (timetable.data?.items.length ?? 0)}{" "}
              <small>classes</small>
            </strong>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon gold-tint">
            <Icon name="check" />
          </span>
          <div>
            <span>Courses below threshold</span>
            <strong>
              {courses.loading
                ? "…"
                : (courses.data?.items.filter((course) => course.below_threshold)
                    .length ?? 0)}
            </strong>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon green-tint">
            <Icon name="clock" />
          </span>
          <div>
            <span>Live classes</span>
            <strong>
              {live.loading ? "…" : (live.data?.items.length ?? 0)}
            </strong>
          </div>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel schedule-panel">
          <div className="panel-heading">
            <div>
              <h2>Live now</h2>
              <p>Classes currently open for check-in</p>
            </div>
          </div>
          <div className="schedule-list">
            {live.loading ? (
              <p role="status">Loading live classes…</p>
            ) : live.error ? (
              <ApiErrorState message={live.error} onRetry={live.reload} />
            ) : live.data?.items.length ? (
              live.data.items.map((item) => (
                <ScheduleCard
                  key={item.session_id}
                  live
                  title={item.course_title}
                  code={item.course_code}
                  time={formatClock(item.started_at)}
                  place={item.venue_name}
                  checkedIn={item.already_checked_in}
                />
              ))
            ) : (
              <p className="empty-state">No class is live right now</p>
            )}
          </div>
        </section>
        <section className="panel schedule-panel">
          <div className="panel-heading">
            <div>
              <h2>Later today</h2>
              <p>Your approved classes on today's timetable</p>
            </div>
          </div>
          {timetable.loading ? (
            <p role="status">Loading today's timetable…</p>
          ) : timetable.error ? (
            <ApiErrorState message={timetable.error} onRetry={timetable.reload} />
          ) : laterToday.length ? (
            <div className="schedule-list">
              {laterToday.map((item) => (
                <ScheduleCard
                  key={item.offering_id}
                  title={item.course_title}
                  code={item.course_code}
                  time={`${formatClock(item.starts_at)} – ${formatClock(item.ends_at)}`}
                  place={item.venue_name}
                />
              ))}
            </div>
          ) : timetable.data?.items.length ? (
            <p className="empty-state">No more classes scheduled today</p>
          ) : (
            <p className="empty-state">Nothing scheduled today</p>
          )}
          <Link to="/courses" className="panel-link">
            View my courses <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>
      <section className="panel attendance-panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance by course</h2>
            <p>Progress against each course's minimum requirement</p>
          </div>
        </div>
        {courses.loading ? (
          <p role="status">Loading course attendance…</p>
        ) : courses.error ? (
          <ApiErrorState message={courses.error} onRetry={courses.reload} />
        ) : courses.data?.items.length ? (
          <div className="course-progress">
            {courses.data.items.map((course) => (
              <div className="progress-row" key={course.offering_id}>
                <div>
                  <span>{course.course_code} · {course.course_title}</span>
                  <b className={course.below_threshold ? "below-threshold" : ""}>
                    {Math.round(course.attendance_percentage)}%
                  </b>
                </div>
                <div className="progress-track">
                  <span
                    className={`progress-fill ${course.below_threshold ? "red" : "blue"}`}
                    style={{ width: `${course.attendance_percentage}%` }}
                  />
                </div>
                {course.below_threshold && (
                  <small className="threshold-warning">
                    <Icon name="dispute" size={13} /> Below the{" "}
                    {course.minimum_attendance_percentage}% attendance requirement
                  </small>
                )}
              </div>
            ))}
          </div>
        ) : (
          <StudentEmptyState />
        )}
      </section>
    </div>
  );
}

function formatClock(value: string): string {
  if (value.includes("T")) return formatTime(value);
  const parsed = parseTime(value);
  if (!parsed) return value;
  const { hours, minutes, offsetMinutes } = parsed;
  const campusMinutes =
    ((hours * 60 + minutes - (offsetMinutes ?? 60) + 60) % 1440 + 1440) %
    1440;
  const campusHours = Math.floor(campusMinutes / 60);
  const campusMinute = campusMinutes % 60;
  return `${campusHours.toString().padStart(2, "0")}:${campusMinute.toString().padStart(2, "0")}`;
}

function getCampusMinutesFromTime(value: string): number | null {
  if (value.includes("T")) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : getCurrentCampusMinutes(date);
  }
  const parsed = parseTime(value);
  if (!parsed) return null;
  const minutes =
    parsed.hours * 60 + parsed.minutes - (parsed.offsetMinutes ?? 60) + 60;
  return ((minutes % 1440) + 1440) % 1440;
}

function parseTime(value: string) {
  const match =
    /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|([+-])(\d{2}):?(\d{2}))?$/.exec(
      value,
    );
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const offsetHours = Number(match[5] ?? 0);
  const offsetMinutesPart = Number(match[6] ?? 0);
  if (offsetHours > 23 || offsetMinutesPart > 59) return null;
  const offsetMinutes = match[3]
    ? (match[4] === "-" ? -1 : 1) *
      (offsetHours * 60 + offsetMinutesPart)
    : null;
  return { hours, minutes, offsetMinutes };
}

function getCurrentCampusMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

function ApiErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="api-state-error" role="alert">
      <p>{message}</p>
      <button className="text-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function StudentEmptyState() {
  return (
    <div className="empty-state">
      <p>You haven't registered for any courses yet</p>
      <Link className="button secondary-button" to="/find-classes">
        Find classes
      </Link>
    </div>
  );
}

export function ScheduleCard({
  live,
  checkedIn = false,
  title,
  code,
  time,
  place,
}: {
  live?: boolean;
  checkedIn?: boolean;
  title: string;
  code: string;
  time: string;
  place: string;
}) {
  return (
    <div className={`schedule-card ${live ? "is-live" : ""}`}>
      <div className="schedule-time">
        <span>{time.split(" – ")[0]}</span>
        {live && <span className="live-dot" />}
      </div>
      <div className="schedule-marker" />
      <div className="schedule-main">
        <div className="schedule-title-row">
          <h3>{title}</h3>
          {live && (
            <span className="live-badge">
              <span /> LIVE NOW
            </span>
          )}
        </div>
        <p>
          <b>{code}</b>
          <span>·</span>
          <Icon name="pin" size={13} /> {place}
        </p>
      </div>
      {live && (
        checkedIn ? (
          <span className="status-chip verified schedule-checkin-status">
            <Icon name="check" size={13} /> Checked in
          </span>
        ) : (
          <Link className="small-checkin" to="/check-in">
            Check in <Icon name="arrow" size={14} />
          </Link>
        )
      )}
    </div>
  );
}

/**
 * The student's own wording for a server classification. "Awaiting
 * confirmation" says what happens next; it is not a verdict on the student.
 */
function getClassificationLabel(
  classification: StudentAttendanceEntry["classification"],
): string {
  const labels: Record<StudentAttendanceEntry["classification"], string> = {
    verified: "Verified",
    present_no_web_log: "Recorded by scan",
    web_only_unverified: "Awaiting confirmation",
    proxy: "Needs review (proxy)",
    absent: "Absent",
    excused: "Excused",
  };
  return labels[classification];
}

export function CheckIn({
  onResult,
  online,
}: {
  onResult: (message: string) => void;
  online: boolean;
}) {
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [loadingLiveClasses, setLoadingLiveClasses] = useState(true);
  const [liveClassesError, setLiveClassesError] = useState("");
  const [digits, setDigits] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [scenario, setScenario] = useState("");
  const [locationText, setLocationText] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [checkInResponse, setCheckInResponse] =
    useState<CheckInResponse | null>(null);
  const [deviceApproval, setDeviceApproval] = useState(false);
  const [touchPointer, setTouchPointer] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const selectedLiveClass = liveClasses.find(
    (liveClass) => liveClass.session_id === selectedSessionId,
  );
  useEffect(() => {
    let active = true;
    setLoadingLiveClasses(true);
    void apiRequest<LiveClassesResponse>("/me/live-classes")
      .then((response) => {
        if (!active) return;
        setLiveClasses(response.items);
        setSelectedSessionId(response.items[0]?.session_id ?? "");
        setLiveClassesError("");
      })
      .catch((caught: unknown) => {
        if (active) setLiveClassesError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setLoadingLiveClasses(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(pointer: coarse)");
    if (!media) return;
    setTouchPointer(media.matches);
    const update = (event: MediaQueryListEvent) =>
      setTouchPointer(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((remaining) => remaining - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  function setDigitAt(index: number, value: string) {
    const numeric = value.replace(/\D/g, "");
    if (numeric.length > 1) {
      const pasted = numeric.slice(0, 6);
      setDigits(pasted);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
      setStatus("idle");
      return;
    }
    const next = digits.split("");
    next[index] = numeric;
    const joined = next.join("").slice(0, 6);
    setDigits(joined);
    setStatus("idle");
    if (numeric && index < 5) inputs.current[index + 1]?.focus();
  }
  function typeKey(key: string) {
    if (key === "⌫") {
      setDigits(digits.slice(0, -1));
    } else if (/^\d$/.test(key) && digits.length < 6) {
      setDigits(`${digits}${key}`);
    }
    setStatus("idle");
  }
  async function requestLocation(): Promise<{
    position: Coordinates | null;
    error: string;
  }> {
    setLocationText("Finding your location…");
    try {
      const position = await getCurrentPosition();
      setAccuracy(position.accuracy);
      setLocationText("Location ready");
      return { position, error: "" };
    } catch (caught) {
      const message =
        caught instanceof GeoError
          ? caught.message
          : "We couldn't find your location. Please try again.";
      setLocationText(message);
      return { position: null, error: message };
    }
  }
  async function submit() {
    if (
      status === "pending" ||
      status === "success" ||
      digits.length !== 6 ||
      !online
    )
      return;
    setStatus("pending");
    try {
      if (!selectedLiveClass)
        throw new Error("Choose a live class before checking in.");
      const { position, error: locationError } = await requestLocation();
      if (!position) {
        setError(
          `${presentApiError("location_required").message} ${locationError}`,
        );
        setErrorCode("location_required");
        setStatus("error");
        return;
      }
      if (scenario && isMockMode()) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        throw new ApiError(400, scenario, scenario.replaceAll("_", " "));
      }
      const payload: CheckInRequest = {
        session_id: selectedLiveClass.session_id,
        code: digits,
        device_hash: getDeviceHash(),
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
      };
      const result = await apiRequest<CheckInResponse>("/checkins", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCheckInResponse(result);
      setStatus("success");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrorCode(caught.code);
        setError(
          caught.code === "location_required"
            ? presentApiError(caught.code, caught.message).message
            : formatApiError(caught),
        );
        if (caught.status === 429 && caught.retryAfter)
          setCooldown(caught.retryAfter);
        if (caught.code === "device_not_bound") setDeviceApproval(true);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Please try again.",
        );
        setErrorCode("unknown");
      }
      setStatus("error");
    }
  }
  return (
    <div className="page-stack checkin-page">
      <PageHeading
        eyebrow="STUDENT · CHECK-IN"
        title="You're here. Let's make it count."
        subtitle="Check in to your live class with the code on your lecturer's screen."
      />
      <div className="checkin-layout">
        <section className="panel checkin-main">
          {status === "success" ? (
            <div
              className="result-screen success-result"
              role="status"
              aria-live="polite"
            >
              <div className="result-icon">
                <Icon name="check" size={32} />
              </div>
              <span className="eyebrow">ATTENDANCE RECORDED</span>
              <h2>You're checked in!</h2>
              <p>
                Your attendance for{" "}
                {selectedLiveClass?.course_title ?? "your live class"} has been
                saved.
              </p>
              <div className="result-detail">
                <span>
                  {selectedLiveClass?.course_code} · Today at{" "}
                  {formatTime(new Date())}
                </span>
                <b>
                  {checkInResponse?.status === "late" ? "Late" : "On time"}
                </b>
              </div>
              {typeof checkInResponse?.distance_meters === "number" && (
                <p>
                  About {Math.round(checkInResponse.distance_meters)} m from the
                  venue
                </p>
              )}
              {checkInResponse?.location_unverified && (
                <p className="location-advisory">
                  Your location couldn't be matched to the venue, so your
                  lecturer can review it. The backend evaluates fingerprint
                  evidence independently from your phone's GPS position.
                </p>
              )}
              <div className="web-checkin-saved">
                <Icon name="check" size={14} /> Web check-in saved
              </div>
              <div className="fingerprint-reminder">
                <b>One more thing</b>
                <span>
                  Please place a finger on the scanner before you leave class.
                </span>
              </div>
              <Link to="/" className="button primary-button">
                Back to overview <Icon name="arrow" size={16} />
              </Link>
            </div>
          ) : status === "error" ? (
            <div
              className="result-screen error-result"
              role="alert"
              aria-live="assertive"
            >
              <div className="result-icon">
                <Icon name="dispute" size={28} />
              </div>
              <span className="eyebrow">CHECK-IN NOT COMPLETE</span>
              <h2>
                {errorCode === "too_many_attempts"
                  ? "Take a short break"
                  : errorCode === "device_not_bound"
                    ? "One quick approval first"
                    : errorCode === "device_already_used"
                      ? "This phone is already in use for this class"
                      : errorCode === "code_expired"
                        ? "That code has expired"
                        : errorCode === "location_required"
                          ? "Location is required to check in"
                        : "Let's try that again"}
              </h2>
              <p>{error}</p>
              {errorCode === "device_already_used" && (
                <p className="lockout-note">
                  A phone records one student per class, so your attendance
                  could not be added on this one. Check in on your own phone, or
                  ask your lecturer to record you before you leave.
                </p>
              )}
              {errorCode === "too_many_attempts" && (
                <p className="lockout-note">
                  Check-in is temporarily locked. Please wait before trying
                  again.
                </p>
              )}
              {deviceApproval && (
                <button
                  className="button secondary-button"
                  onClick={() =>
                    onResult("Device approval request sent to your lecturer.")
                  }
                >
                  Request device approval
                </button>
              )}
              {errorCode === "location_required" ? (
                <button
                  className="button primary-button"
                  onClick={() => void submit()}
                >
                  Retry location and check in
                </button>
              ) : (
                <button
                  className="button secondary-button"
                  onClick={() => {
                    setStatus("idle");
                    setError("");
                    setErrorCode("");
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              {!online && (
                <div className="checkin-offline" role="alert">
                  <b>No connection</b>
                  <span>
                    Check-ins can't be saved offline, because the class code is
                    verified live. Tell your lecturer, who can mark you
                    manually.
                  </span>
                </div>
              )}
              <div className="section-title">
                <span className="step-number">01</span>
                <div>
                  <h2>Choose your class</h2>
                  <p>Select an active class to check in.</p>
                </div>
              </div>
              <label className="field-label" htmlFor="live-class">
                Live class
              </label>
              <select
                id="live-class"
                className="field-control class-select"
                value={selectedSessionId}
                disabled={loadingLiveClasses || liveClasses.length === 0}
                onChange={(event) => setSelectedSessionId(event.target.value)}
              >
                {liveClasses.map((liveClass) => (
                  <option
                    key={liveClass.session_id}
                    value={liveClass.session_id}
                    disabled={liveClass.already_checked_in}
                  >
                    {liveClass.course_title} · {liveClass.course_code}
                    {liveClass.already_checked_in ? " · Checked in" : ""}
                  </option>
                ))}
              </select>
              {loadingLiveClasses && (
                <p role="status">Loading live classes…</p>
              )}
              {liveClassesError && (
                <div className="form-error" role="alert">
                  {liveClassesError}
                </div>
              )}
              {!loadingLiveClasses &&
                !liveClassesError &&
                liveClasses.length === 0 && (
                  <p role="status">
                    There are no live classes available right now.
                  </p>
                )}
              {selectedLiveClass && <div className="class-context">
                <span className="class-context-icon">
                  <Icon name="book" />
                </span>
                <div>
                  <b>{selectedLiveClass.course_title}</b>
                  <span>
                    {selectedLiveClass.course_code} <i>·</i>{" "}
                    {selectedLiveClass.venue_name}
                  </span>
                </div>
                <span className="live-badge">
                  <span /> IN SESSION
                </span>
              </div>}
              <div className="section-title code-title">
                <span className="step-number">02</span>
                <div>
                  <h2>Enter your class code</h2>
                  <p>Ask your lecturer for the six-digit code.</p>
                </div>
              </div>
              <label className="field-label">6-digit attendance code</label>
              <div
                className="code-boxes"
                role="group"
                aria-label="Six-digit attendance code"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputs.current[index] = element;
                    }}
                    className="code-box"
                    aria-label={`Code digit ${index + 1}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    readOnly={touchPointer}
                    value={digits[index] ?? ""}
                    onChange={(event) => setDigitAt(index, event.target.value)}
                    onPaste={(event) => {
                      event.preventDefault();
                      setDigitAt(index, event.clipboardData.getData("text"));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace") {
                        event.preventDefault();
                        if (digits[index]) {
                          const next = digits.split("");
                          next[index] = "";
                          setDigits(next.join(""));
                        } else {
                          const next = digits.split("");
                          next[index - 1] = "";
                          setDigits(next.join(""));
                          inputs.current[Math.max(0, index - 1)]?.focus();
                        }
                      } else if (event.key === "ArrowLeft") {
                        inputs.current[Math.max(0, index - 1)]?.focus();
                      } else if (event.key === "ArrowRight") {
                        inputs.current[Math.min(5, index + 1)]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              {touchPointer && (
                <div
                  className="numeric-keypad"
                  aria-label="Numeric code keypad"
                >
                  {[
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "",
                    "0",
                    "⌫",
                  ].map((key, index) =>
                    key ? (
                      <button
                        key={key}
                        className="keypad-key"
                        aria-label={key === "⌫" ? "Backspace" : `Enter ${key}`}
                        onClick={() => typeKey(key)}
                        disabled={key !== "⌫" && digits.length >= 6}
                      >
                        {key}
                      </button>
                    ) : (
                      <span key={`spacer-${index}`} />
                    ),
                  )}
                </div>
              )}
              <div className="input-hint">
                The code refreshes every 30 seconds{" "}
                <span className="code-pulse" />
              </div>
              <div className="section-title location-title">
                <span className="step-number">03</span>
                <div>
                  <h2>Confirm your location (required)</h2>
                  <p>
                    Your browser must provide a location fix to send check-in.
                    The class code remains decisive; distance from the venue
                    alone will not block check-in.
                  </p>
                </div>
              </div>
              <div className="location-box">
                <div className="location-icon">
                  <Icon name="pin" />
                </div>
                <div>
                  <b>Location is only used for this check-in</b>
                  <span>
                    {locationText ||
                      "We request a fresh position when you check in and use it only as attendance evidence for this class."}
                  </span>
                </div>
                <button
                  className="location-button"
                  onClick={() => void requestLocation()}
                  disabled={
                    status === "pending" ||
                    locationText === "Finding your location…"
                  }
                >
                  {locationText === "Finding your location…"
                    ? "Finding…"
                    : "Get location"}
                </button>
              </div>
              {accuracy !== null && (
                <div
                  className={`accuracy-note ${accuracy > 100 ? "accuracy-warning" : ""}`}
                >
                  {accuracy > 100
                    ? "Accuracy is over 100 m. The server will evaluate it as evidence; distance alone does not block check-in."
                    : `Location accuracy: about ${Math.round(accuracy)} m`}
                </div>
              )}
              <div className="checkin-actions">
                <button
                  className="button primary-button submit-checkin"
                  onClick={submit}
                  disabled={
                    digits.length !== 6 ||
                    status === "pending" ||
                    locationText === "Finding your location…" ||
                    !online ||
                    !selectedLiveClass ||
                    selectedLiveClass.already_checked_in ||
                    cooldown > 0
                  }
                >
                  {status === "pending"
                    ? "Checking you in…"
                    : cooldown > 0
                      ? `Try again in ${cooldown}s`
                      : "Check in to class"}{" "}
                  <Icon name="arrow" size={17} />
                </button>
                <span>
                  One tap is all it takes <span className="tiny-shield">✳</span>
                </span>
              </div>
              {isMockMode() && (
                <details className="scenario-picker">
                  <summary>Developer: check-in scenario</summary>
                  <select
                    aria-label="Check-in error scenario"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value)}
                  >
                    <option value="">Success (code 381204)</option>
                    {CHECKIN_ERRORS.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </details>
              )}
            </>
          )}
        </section>
        <aside className="checkin-aside">
          <div className="panel class-now">
            <div className="aside-overline">
              <span className="live-dot" /> LIVE CLASS
            </div>
            <h2>{selectedLiveClass?.course_title ?? "No live class selected"}</h2>
            {selectedLiveClass && (
              <span className="class-course-code">
                {selectedLiveClass.course_code}
              </span>
            )}
            <div className="aside-divider" />
            <div className="class-detail">
              <Icon name="clock" size={17} />
              <span>
                {selectedLiveClass
                  ? `Started ${formatTime(selectedLiveClass.started_at)}`
                  : "No live session"}
              </span>
            </div>
            <div className="class-detail">
              <Icon name="pin" size={17} />
              <span>
                {selectedLiveClass?.venue_name ?? "Venue unavailable"}
              </span>
            </div>
          </div>
          <div className="privacy-card">
            <span className="privacy-mark">✳</span>
            <div>
              <b>Your privacy matters</b>
              <p>
                Your location is only checked at the moment you check in. It's
                never tracked in the background.
              </p>
              <a href="/profile">
                Learn about your data <Icon name="arrow" size={13} />
              </a>
            </div>
          </div>
          <div className="need-help">
            <Icon name="dispute" size={16} />
            <span>
              Having trouble? <a href="/disputes">Get help with check-in</a>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

type BrowseOffering = {
  offering_id: string;
  course_code: string;
  course_title: string;
  department_id: string;
  department_name: string;
  level: number | string;
  kind: "departmental" | "general";
  registration_mode: SearchOffering["registration_mode"];
  registration_status: SearchOffering["registration_status"];
  lecturers: string[];
  is_registered: boolean;
  is_pending: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Normalises an item from either GET /me/offerings (the default scoped list,
// whose browse fields arrive as additionalProperties) or GET /offerings/search
// (the typed text search) into one browse card shape.
function toBrowseOffering(raw: Record<string, unknown>): BrowseOffering {
  const kind = raw.kind;
  const mode = raw.registration_mode;
  const status = raw.registration_status;
  const level = raw.level;
  return {
    offering_id: asString(raw.offering_id) || asString(raw.id),
    course_code: asString(raw.course_code) || asString(raw.code),
    course_title: asString(raw.course_title) || asString(raw.title),
    department_id: asString(raw.department_id),
    department_name: asString(raw.department_name),
    level: typeof level === "number" ? level : asString(level),
    kind: kind === "general" ? "general" : "departmental",
    registration_mode:
      mode === "auto" || mode === "approval" || mode === "closed"
        ? mode
        : "open",
    registration_status:
      status === "pending" || status === "approved" || status === "rejected"
        ? status
        : "none",
    lecturers: Array.isArray(raw.lecturers)
      ? raw.lecturers.filter((name): name is string => typeof name === "string")
      : [],
    is_registered: raw.is_registered === true,
    is_pending: raw.is_pending === true,
  };
}

export function FindClasses() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState<SearchOfferingsQuery["kind"] | "">("");
  const [registeringId, setRegisteringId] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [mutationErrorId, setMutationErrorId] = useState("");
  const [registrationResult, setRegistrationResult] = useState<{
    id: string;
    status: "pending" | "approved" | "rejected";
  } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const departments = useApiResource<DepartmentCatalogueResponse>(
    "/departments?limit=200&offset=0",
  );
  const departmentOptions =
    departments.data?.items.flatMap((department) =>
      typeof department.name === "string"
        ? [{ id: department.id, name: department.name }]
        : [],
    ) ?? [];
  const searchTerm = debouncedQuery.trim();
  const searching = searchTerm !== "";
  // Default browse list — already scoped to the student's level and department.
  // No query param; never hit /offerings/search with an empty q (it 400s).
  const browse = useApiResource<OfferingsResponse>(
    searching ? null : "/me/offerings?limit=100&offset=0",
  );
  const searchParams = new URLSearchParams({ q: searchTerm });
  if (departmentId) searchParams.set("department_id", departmentId);
  if (level) searchParams.set("level", level);
  if (kind) searchParams.set("kind", kind);
  // Text search only runs once the student has typed a term (debounced).
  const search = useApiResource<SearchOfferingsResponse>(
    searching ? `/offerings/search?${searchParams.toString()}` : null,
  );
  // The browse list (/me/offerings) carries no registration status, so cross-
  // reference the student's approved courses and pending requests to mark each
  // card. A self-registered (open) offering lands in /me/courses immediately.
  const myCourses = useApiResource<StudentCoursesResponse>("/me/courses");
  const myPending = useApiResource<PendingRegistrationsResponse>(
    "/me/registrations",
  );
  const approvedOfferingIds = new Set(
    myCourses.data?.items.map((item) => item.offering_id) ?? [],
  );
  const pendingOfferingIds = new Set(
    myPending.data?.items.map((item) => item.offering_id) ?? [],
  );
  const active = searching ? search : browse;
  const normalized = (active.data?.items ?? []).map((item) =>
    toBrowseOffering(item as Record<string, unknown>),
  );
  // Search sends the filters to the server; the default list is filtered here.
  const results = searching
    ? normalized
    : normalized.filter((offering) => {
        if (departmentId && offering.department_id !== departmentId)
          return false;
        if (level && String(offering.level) !== level) return false;
        if (kind && offering.kind !== kind) return false;
        return true;
      });

  async function register(offering: BrowseOffering) {
    setRegisteringId(offering.offering_id);
    setMutationError("");
    setMutationErrorId("");
    try {
      const registration = await apiRequest<RegistrationResponse>(
        `/offerings/${encodeURIComponent(offering.offering_id)}/registrations`,
        {
        method: "POST",
        },
      );
      active.reload();
      // Reflect the new registration everywhere this view reads it: an approved
      // (self-register) course appears in /me/courses, a pending one in
      // /me/registrations. Other pages re-fetch these on navigation.
      myCourses.reload();
      myPending.reload();
      setRegistrationResult({
        id: offering.offering_id,
        status: registration.status,
      });
    } catch (caught: unknown) {
      setMutationError(formatApiError(caught));
      setMutationErrorId(offering.offering_id);
    } finally {
      setRegisteringId("");
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR LEARNING"
        title="Find a class"
        subtitle="Discover courses and build a schedule that works for you."
      />
      <section className="panel browse-panel">
        <div className="search-row">
          <label className="search-field">
            <Icon name="search" />
            <input
              placeholder="Search by course name or code…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search classes"
            />
          </label>
        </div>
        <div className="class-filter-controls">
          <label>
            Department
            <select
              className="filter-select"
              aria-label="Filter by department"
              value={departmentId}
              disabled={departments.loading || departments.error !== ""}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Level
            <select
              className="filter-select"
              aria-label="Filter by level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">All levels</option>
              {[100, 200, 300, 400, 500, 600].map((value) => (
                <option key={value} value={value}>
                  {value} level
                </option>
              ))}
            </select>
          </label>
          <label>
            Kind
            <select
              className="filter-select"
              aria-label="Filter by course kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as SearchOfferingsQuery["kind"] | "")
              }
            >
              <option value="">All types</option>
              <option value="departmental">Departmental</option>
              <option value="general">General</option>
            </select>
          </label>
          <button
            className="clear-filters"
            onClick={() => {
              setQuery("");
              setDepartmentId("");
              setLevel("");
              setKind("");
            }}
          >
            Reset filters
          </button>
        </div>
        {departments.error && (
          <ApiErrorState
            message={`Could not load departments: ${departments.error}`}
            onRetry={departments.reload}
          />
        )}
        {active.loading ? (
          <p role="status">
            {searching ? "Searching classes…" : "Loading classes…"}
          </p>
        ) : active.error ? (
          <ApiErrorState message={active.error} onRetry={active.reload} />
        ) : (
          <div className="browse-count">
            Showing <b>{results.length} classes</b>
          </div>
        )}
        <div className="course-results">
          {!active.loading && !active.error && results.length === 0 && (
            <p className="empty-state">
              {searching
                ? "No classes match your search."
                : "No classes are available for you yet."}
            </p>
          )}
          {results.map((course) => {
            const actionStatus =
              registrationResult?.id === course.offering_id
                ? registrationResult.status
                : course.registration_status;
            const closed = course.registration_mode === "closed";
            const registered =
              actionStatus === "approved" ||
              course.is_registered ||
              approvedOfferingIds.has(course.offering_id);
            const pending =
              actionStatus === "pending" ||
              course.is_pending ||
              pendingOfferingIds.has(course.offering_id);
            return (
            <article className="course-result" key={course.offering_id}>
              <div className="course-monogram">
                {course.course_code.slice(0, 3)}
              </div>
              <div className="course-result-main">
                <div className="result-title-line">
                  <h3>{course.course_title}</h3>
                  <span className="kind-tag">
                    {course.kind === "general" ? "General" : "Departmental"}
                  </span>
                </div>
                <p>
                  {course.course_code} <span>·</span> {course.department_name}{" "}
                  <span>·</span> {course.level} level
                </p>
                <small>
                  {course.lecturers.join(", ")} <span>·</span>{" "}
                  {course.registration_mode === "approval"
                    ? "Approval required"
                    : `Registration ${course.registration_mode}`}
                </small>
                {closed && (
                  <small className="registration-reason">
                    Registration is closed for this offering.
                  </small>
                )}
                {pending && (
                  <span className="status-chip pending">
                    <Icon name="clock" size={13} /> Pending approval
                  </span>
                )}
                {registered && (
                  <span className="status-chip verified">
                    <Icon name="check" size={13} /> Registered
                  </span>
                )}
                {mutationErrorId === course.offering_id && (
                  <span className="registration-error" role="alert">
                    {mutationError}
                  </span>
                )}
              </div>
              <button
                className={`button ${registered ? "registered-button" : "secondary-button"}`}
                disabled={closed || registered || pending || registeringId === course.offering_id}
                onClick={() => void register(course)}
              >
                {registeringId === course.offering_id
                  ? "Submitting…"
                  : registered
                    ? "Registered"
                    : pending
                      ? "Request pending"
                      : closed
                        ? "Registration closed"
                        : course.registration_mode === "approval"
                          ? "Request to join"
                          : "Register"}
              </button>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function Courses() {
  const { data, loading, error, reload } =
    useApiResource<StudentCoursesResponse>("/me/courses");
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR LEARNING"
        title="My courses"
        subtitle="Your semester, all in one place."
      />
      {loading ? (
        <p role="status">Loading your courses…</p>
      ) : error ? (
        <ApiErrorState message={error} onRetry={reload} />
      ) : data?.items.length ? (
        <div className="course-card-grid">
          {data.items.map((course) => (
            <article className="panel my-course-card" key={course.offering_id}>
              <span
                className={`course-label ${course.below_threshold ? "label-warning" : ""}`}
              >
                <Icon
                  name={course.below_threshold ? "dispute" : "check"}
                  size={12}
                />
                {course.below_threshold ? "Needs attention" : "Enrolled"}
              </span>
              <h2>{course.course_title}</h2>
              <span className="course-code-line">
                {course.course_code} <span>·</span>{" "}
                {course.lecturer_names.join(", ")}
              </span>
              <div className="my-course-attendance">
                <div>
                  <span>
                    Attendance ({course.sessions_attended}/
                    {course.sessions_held} sessions)
                  </span>
                  <b
                    className={course.below_threshold ? "below-threshold" : ""}
                  >
                    {Math.round(course.attendance_percentage)}%
                  </b>
                </div>
                <div className="progress-track">
                  <span
                    className={`progress-fill ${course.below_threshold ? "red" : "blue"}`}
                    style={{ width: `${course.attendance_percentage}%` }}
                  />
                </div>
                <small>
                  Minimum: {course.minimum_attendance_percentage}%
                </small>
              </div>
              <Link
                to={`/history?offeringId=${encodeURIComponent(course.offering_id)}`}
                className="panel-link"
              >
                View attendance history <Icon name="arrow" size={15} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <StudentEmptyState />
      )}
    </div>
  );
}

export function History() {
  const courses = useApiResource<StudentCoursesResponse>("/me/courses");
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [searchParams] = useSearchParams();
  const requestedOfferingId =
    selectedOfferingId ||
    searchParams.get("offeringId") ||
    courses.data?.items[0]?.offering_id ||
    "";
  const attendance = useApiResource<StudentAttendanceResponse>(
    requestedOfferingId
      ? `/me/attendance?offering_id=${encodeURIComponent(requestedOfferingId)}`
      : null,
  );
  const selectedCourse = courses.data?.items.find(
    (course) => course.offering_id === requestedOfferingId,
  );
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR RECORDS"
        title="Attendance history"
        subtitle="A record of every class you've shown up for."
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Course attendance</h2>
            <p>Choose a course to see your attendance history</p>
          </div>
          <select
            className="filter-select"
            aria-label="Attendance history course"
            value={requestedOfferingId}
            disabled={courses.loading || !courses.data?.items.length}
            onChange={(event) => setSelectedOfferingId(event.target.value)}
          >
            {courses.data?.items.map((course) => (
              <option key={course.offering_id} value={course.offering_id}>
                {course.course_code} · {course.course_title}
              </option>
            ))}
          </select>
        </div>
        {courses.loading ? (
          <p role="status">Loading your courses…</p>
        ) : courses.error ? (
          <ApiErrorState message={courses.error} onRetry={courses.reload} />
        ) : !courses.data?.items.length ? (
          <StudentEmptyState />
        ) : attendance.loading ? (
          <p role="status">Loading attendance history…</p>
        ) : attendance.error ? (
          <ApiErrorState
            message={attendance.error}
            onRetry={attendance.reload}
          />
        ) : attendance.data?.items.length ? (
          <div className="history-list">
            {attendance.data.items.map((item) => (
              <div className="history-row" key={item.session_id}>
                <span className="history-date">
                  {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                    undefined,
                    { dateStyle: "medium" },
                  )}
                </span>
                <div className="history-course">
                  <b>{selectedCourse?.course_title ?? "Course session"}</b>
                  <span>
                    {selectedCourse?.course_code} ·{" "}
                    {getClassificationLabel(item.classification)}
                    {item.override_reason ? ` · ${item.override_reason}` : ""}
                  </span>
                </div>
                <span className={`status-chip ${item.status}`}>
                  <Icon
                    name={item.status === "absent" ? "dispute" : "check"}
                    size={13}
                  />
                  {item.status.replace(/\b\w/g, (letter) =>
                    letter.toUpperCase(),
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No attendance records for this course yet.</p>
        )}
      </section>
    </div>
  );
}
