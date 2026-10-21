import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "@/shared/lib/apiClient";
import { ApiError, formatApiError } from "@/api/errors";
import { getDeviceHash } from "@/shared/lib/deviceHash";
import { formatTime } from "@/shared/lib/format";
import { getCurrentPosition, GeoError } from "@/shared/lib/geo";
import type {
  CheckInRequest,
  CheckInResponse,
  LiveClass,
  LiveClassesResponse,
  RegistrationResponse,
  SearchOffering,
  SearchOfferingsQuery,
  SearchOfferingsResponse,
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
      const [hours = "0", minutes = "0"] = item.starts_at.split(":");
      const startsAt = Number(hours) * 60 + Number(minutes);
      return startsAt > currentMinutes;
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
                  time={`${formatClock(item.started_at)} · ${item.venue_name}`}
                  place={item.lecturer_name}
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
  const [hours = "0", minutes = "0"] = value.split(":");
  return `${Number(hours).toString().padStart(2, "0")}:${minutes}`;
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
  title,
  code,
  time,
  place,
}: {
  live?: boolean;
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
        <Link className="small-checkin" to="/check-in">
          Check in <Icon name="arrow" size={14} />
        </Link>
      )}
    </div>
  );
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
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
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
  async function requestLocation() {
    setLocationText("Finding your location…");
    try {
      const position = await getCurrentPosition();
      setCoordinates(position);
      setAccuracy(position.accuracy);
      setLocationText("Location ready");
    } catch (caught) {
      setLocationText(
        caught instanceof GeoError
          ? caught.message
          : "We couldn't find your location. Please try again.",
      );
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
      if (scenario && isMockMode()) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        throw new ApiError(400, scenario, scenario.replaceAll("_", " "));
      }
      if (!selectedLiveClass)
        throw new Error("Choose a live class before checking in.");
      if (!coordinates)
        throw new Error("Share your location before checking in.");
      const payload: CheckInRequest = {
        session_id: selectedLiveClass.session_id,
        code: digits,
        lat: coordinates.lat,
        lng: coordinates.lng,
        accuracy: coordinates.accuracy,
        device_hash: getDeviceHash(),
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
        setError(formatApiError(caught));
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
                    : errorCode === "code_expired"
                      ? "That code has expired"
                      : "Let's try that again"}
              </h2>
              <p>{error}</p>
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
            </div>
          ) : (
            <>
              {!online && (
                <div className="checkin-offline" role="alert">
                  <b>No connection</b>
                  <span>
                    Check-ins can't be saved offline, because the code and your
                    location are verified live. Tell your lecturer, who can mark
                    you manually.
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
                  <h2>Confirm your location</h2>
                  <p>Your location helps verify you're in class.</p>
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
                      "We only use your location to confirm you're near the class venue."}
                  </span>
                </div>
                <button className="location-button" onClick={requestLocation}>
                  {locationText === "Finding your location…"
                    ? "Finding…"
                    : "Share location"}
                </button>
              </div>
              {accuracy !== null && (
                <div
                  className={`accuracy-note ${accuracy > 100 ? "accuracy-warning" : ""}`}
                >
                  {accuracy > 100
                    ? "Accuracy is over 100 m. Try moving near a window for a clearer signal."
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

export function FindClasses() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState<SearchOfferingsQuery["kind"] | "">("");
  const [departments, setDepartments] = useState<
    { id: SearchOffering["department_id"]; name: SearchOffering["department_name"] }[]
  >([]);
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
  const searchParams = new URLSearchParams({ q: debouncedQuery });
  if (departmentId) searchParams.set("department_id", departmentId);
  if (level) searchParams.set("level", level);
  if (kind) searchParams.set("kind", kind);
  const search = useApiResource<SearchOfferingsResponse>(
    `/offerings/search?${searchParams.toString()}`,
  );
  const results = search.data?.items ?? [];
  useEffect(() => {
    const offerings = search.data?.items;
    if (!offerings?.length) return;
    setDepartments((current) => {
      const next = new Map(
        current.map((department) => [department.id, department]),
      );
      offerings.forEach((item) =>
        next.set(item.department_id, {
          id: item.department_id,
          name: item.department_name,
        }),
      );
      return [...next.values()];
    });
  }, [search.data]);

  async function register(offering: SearchOffering) {
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
      search.reload();
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
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => {
                return (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                );
              })}
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
        {search.loading ? (
          <p role="status">Searching classes…</p>
        ) : search.error ? (
          <ApiErrorState message={search.error} onRetry={search.reload} />
        ) : (
          <div className="browse-count">
            Showing <b>{results.length} classes</b>
          </div>
        )}
        <div className="course-results">
          {!search.loading && !search.error && results.length === 0 && (
            <p className="empty-state">No classes match your search.</p>
          )}
          {results.map((course) => {
            const actionStatus =
              registrationResult?.id === course.offering_id
                ? registrationResult.status
                : course.registration_status;
            const closed = course.registration_mode === "closed";
            const registered = actionStatus === "approved" || course.is_registered;
            const pending = actionStatus === "pending" || course.is_pending;
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
                    {selectedCourse?.course_code} · {item.classification.replaceAll("_", " ")}
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
