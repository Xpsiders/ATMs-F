import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/shared/lib/apiClient";
import { ApiError, presentApiError } from "@/api/errors";
import { getDeviceHash } from "@/shared/lib/deviceHash";
import { formatTime } from "@/shared/lib/format";
import { getCurrentPosition, GeoError } from "@/shared/lib/geo";
import type { CheckInRequest, CheckInResponse } from "@/api/contracts";
import { getMockSession, isMockMode } from "@/mocks/auth";
import {
  getDemoState,
  recordDemoCheckIn,
  updateDemoState,
} from "@/mocks/store";
import { useDemoState } from "@/mocks/useDemoState";
import {
  CHECKIN_ERRORS,
  COURSES,
  Icon,
  LIVE_CLASS,
  PageHeading,
} from "@/shared/ui/primitives";

export function Dashboard() {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="MONDAY, 17 FEBRUARY 2025"
        title={
          <>
            Good morning, Amara <span className="wave">✳</span>
          </>
        }
        subtitle="A new week is a fresh chance to show up. Here's your day at a glance."
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
              04 <small>classes</small>
            </strong>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon gold-tint">
            <Icon name="check" />
          </span>
          <div>
            <span>Overall attendance</span>
            <strong>
              82<small>%</small> <em className="trend">↑ 4%</em>
            </strong>
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-icon green-tint">
            <Icon name="clock" />
          </span>
          <div>
            <span>Next class starts in</span>
            <strong>
              12 <small>min</small>
            </strong>
          </div>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel schedule-panel">
          <div className="panel-heading">
            <div>
              <h2>Today's schedule</h2>
              <p>
                Monday, 17 February <span className="date-dot">·</span> 4
                classes
              </p>
            </div>
            <button className="text-button">
              Full timetable <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="schedule-list">
            <div className="timeline-line" />
            <ScheduleCard
              live={true}
              title={LIVE_CLASS.title}
              code={LIVE_CLASS.code}
              time="9:00 – 10:30 AM"
              place={LIVE_CLASS.room}
            />
            <ScheduleCard
              title="Database Management"
              code="CSC 326"
              time="11:00 AM – 12:30 PM"
              place="ICT Building · Room 14"
            />
            <ScheduleCard
              title="Software Engineering"
              code="CSC 318"
              time="1:00 – 2:30 PM"
              place="New Science · LT 1"
            />
          </div>
        </section>
        <section className="panel attendance-panel">
          <div className="panel-heading">
            <div>
              <h2>Attendance snapshot</h2>
              <p>You're doing well. Keep it up!</p>
            </div>
            <button
              className="dots-button"
              aria-label="More attendance options"
            >
              ···
            </button>
          </div>
          <div className="overall-attendance">
            <div className="attendance-ring">
              <div>
                <strong>82%</strong>
                <span>overall</span>
              </div>
            </div>
            <div className="ring-note">
              <span className="ring-note-dot" />
              <span>
                Looking good!<small>You're above the 75% requirement.</small>
              </span>
            </div>
          </div>
          <div className="course-progress">
            {COURSES.map((course) => (
              <div className="progress-row" key={course.code}>
                <div>
                  <span>{course.title}</span>
                  <b className={course.tone === "red" ? "below-threshold" : ""}>
                    {course.percent}%
                  </b>
                </div>
                <div className="progress-track">
                  <span
                    className={`progress-fill ${course.tone}`}
                    style={{ width: `${course.percent}%` }}
                  />
                </div>
                {course.percent < 75 && (
                  <small className="threshold-warning">
                    <Icon name="dispute" size={13} /> Below the 75% attendance
                    requirement
                  </small>
                )}
              </div>
            ))}
          </div>
          <Link to="/courses" className="panel-link">
            View all courses <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>
      <section className="quote-banner">
        <div className="quote-mark">“</div>
        <div>
          <p>Small steps every day lead to big things.</p>
          <span>Show up for your future.</span>
        </div>
        <div className="quote-art">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
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
  const demoState = useDemoState();
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
      if (scenario && import.meta.env.DEV) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        throw new ApiError(400, scenario, scenario.replaceAll("_", " "));
      }
      if (isMockMode()) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        const session = demoState.sessions.find(
          (candidate) => candidate.id === "demo-session",
        );
        if (!session || session.state !== "live")
          throw new ApiError(400, "session_closed", "This session is closed.");
        if (digits !== session.code)
          throw new ApiError(400, "wrong_code", "The code did not match.");
        if (!coordinates)
          throw new Error("Share your location before checking in.");
        const account = getMockSession();
        const student = account
          ? getDemoState().students.find(
              (candidate) => candidate.name === account.name,
            )
          : undefined;
        if (!student)
          throw new Error("The demo student is missing from the roster.");
        recordDemoCheckIn(student.id, "verified");
        setCheckInResponse({
          status: "verified",
          late: false,
          distance_meters: 24,
        });
        setStatus("success");
        return;
      }
      if (!coordinates)
        throw new Error("Share your location before checking in.");
      const payload: CheckInRequest = {
        session_id: "demo-session",
        code: digits,
        lat: coordinates.lat,
        lng: coordinates.lng,
        accuracy: coordinates.accuracy,
        device_hash: getDeviceHash(),
      };
      const result = await apiRequest<CheckInResponse>("/check-ins", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCheckInResponse(result);
      setStatus("success");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrorCode(caught.code);
        setError(presentApiError(caught.code, caught.message).message);
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
              <h2>You're checked in, Amara!</h2>
              <p>Your attendance for {LIVE_CLASS.title} has been saved.</p>
              <div className="result-detail">
                <span>
                  {LIVE_CLASS.code} · Today at {formatTime(new Date())}
                </span>
                <b>Verified · {checkInResponse?.late ? "Late" : "On time"}</b>
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
              <select id="live-class" className="field-control class-select">
                <option>
                  {LIVE_CLASS.title} · {LIVE_CLASS.code}
                </option>
              </select>
              <div className="class-context">
                <span className="class-context-icon">
                  <Icon name="book" />
                </span>
                <div>
                  <b>{LIVE_CLASS.title}</b>
                  <span>
                    {LIVE_CLASS.code} <i>·</i> {LIVE_CLASS.room}
                  </span>
                </div>
                <span className="live-badge">
                  <span /> IN SESSION
                </span>
              </div>
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
              {import.meta.env.DEV && (
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
            <h2>{LIVE_CLASS.title}</h2>
            <span className="class-course-code">{LIVE_CLASS.code}</span>
            <div className="aside-divider" />
            <div className="class-detail">
              <Icon name="clock" size={17} />
              <span>
                9:00 – 10:30 AM<small>Ends in 42 minutes</small>
              </span>
            </div>
            <div className="class-detail">
              <Icon name="pin" size={17} />
              <span>
                Engineering Building<small>Lecture Theatre 2</small>
              </span>
            </div>
            <div className="aside-count">
              <div>
                <strong>28</strong>
                <span>students here</span>
              </div>
              <div className="student-stack">
                <span>JM</span>
                <span>EK</span>
                <span>+26</span>
              </div>
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
  const demoState = useDemoState();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [department, setDepartment] = useState("Computer Engineering");
  const [level, setLevel] = useState("300 level");
  const [kind, setKind] = useState("All types");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const courses = demoState.offerings
    .map((offering) => ({
      name: offering.title,
      code: offering.code,
      dept: offering.department,
      level: offering.level,
      kind: offering.kind,
      lecturer: offering.lecturer,
      mode: offering.registration,
    }))
    .filter(
      (course) =>
        `${course.name} ${course.code} ${course.lecturer}`
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) &&
        (department === "All departments" || course.dept === department) &&
        (level === "All levels" || course.level === level) &&
        (kind === "All types" || course.kind === kind),
    );
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
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option>Computer Engineering</option>
              <option>Electrical Engineering</option>
              <option>General Studies</option>
              <option>All departments</option>
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
              <option>300 level</option>
              <option>200 level</option>
              <option>All levels</option>
            </select>
          </label>
          <label>
            Kind
            <select
              className="filter-select"
              aria-label="Filter by course kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option>All types</option>
              <option>Core</option>
              <option>Elective</option>
              <option>General</option>
            </select>
          </label>
          <button
            className="clear-filters"
            onClick={() => {
              setQuery("");
              setDepartment("Computer Engineering");
              setLevel("300 level");
              setKind("All types");
            }}
          >
            Reset filters
          </button>
        </div>
        <div className="browse-count">
          Showing <b>{courses.length} classes</b> for your department and level
        </div>
        <div className="course-results">
          {courses.map((course) => (
            <article className="course-result" key={course.code}>
              <div className="course-monogram">{course.code.slice(0, 3)}</div>
              <div className="course-result-main">
                <div className="result-title-line">
                  <h3>{course.name}</h3>
                  <span className="kind-tag">{course.kind}</span>
                </div>
                <p>
                  {course.code} <span>·</span> {course.dept} <span>·</span>{" "}
                  {course.level}
                </p>
                <small>
                  {course.lecturer} <span>·</span> Registration{" "}
                  {course.mode.toLowerCase()}
                </small>
              </div>
              <button
                className={`button ${demoState.enrollments.includes(course.code) ? "registered-button" : "secondary-button"}`}
                disabled={
                  course.mode === "Closed" ||
                  demoState.enrollments.includes(course.code)
                }
                onClick={() => {
                  if (!isMockMode()) return;
                  const enrolled = demoState.enrollments.includes(course.code);
                  if (!enrolled)
                    updateDemoState((current) => ({
                      ...current,
                      enrollments: [...current.enrollments, course.code],
                    }));
                }}
              >
                {demoState.enrollments.includes(course.code)
                  ? "Registered ✓"
                  : course.mode === "Approval"
                    ? "Request to join"
                    : course.mode === "Closed"
                      ? "Registration closed"
                      : "Register"}{" "}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Courses() {
  const demoState = useDemoState();
  const courses = COURSES.filter((course) =>
    demoState.enrollments.includes(course.code),
  );
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR LEARNING"
        title="My courses"
        subtitle="Your semester, all in one place."
      />
      <div className="course-card-grid">
        {courses.map((course, index) => (
          <article className="panel my-course-card" key={course.code}>
            <span
              className={`course-label ${index === 1 ? "label-warning" : ""}`}
            >
              {index === 1 ? "NEEDS ATTENTION" : "ENROLLED"}
            </span>
            <h2>{course.title}</h2>
            <span className="course-code-line">
              {course.code} <span>·</span> {index === 2 ? "Elective" : "Core"}
            </span>
            <div className="my-course-attendance">
              <div>
                <span>Attendance</span>
                <b className={course.percent < 75 ? "below-threshold" : ""}>
                  {course.percent}%
                </b>
              </div>
              <div className="progress-track">
                <span
                  className={`progress-fill ${course.tone}`}
                  style={{ width: `${course.percent}%` }}
                />
              </div>
            </div>
            <Link to="/history" className="panel-link">
              View attendance history <Icon name="arrow" size={15} />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function History() {
  const demoState = useDemoState();
  const [filter, setFilter] = useState("All courses");
  const account = getMockSession();
  const student = account
    ? demoState.students.find((candidate) => candidate.name === account.name)
    : undefined;
  const mockRows =
    isMockMode() && student
      ? demoState.attendance
          .filter((record) => record.studentId === student.id)
          .map((record) => {
            const offering = demoState.offerings.find(
              (candidate) => candidate.code === record.offeringCode,
            );
            const status = record.status.replaceAll("_", " ");
            return [
              "Today · 17 Feb",
              offering?.title ?? record.offeringCode,
              record.offeringCode,
              status === "verified"
                ? "Verified"
                : status.replace(/\b\w/g, (letter) => letter.toUpperCase()),
              record.status,
            ];
          })
      : null;
  const historyRows = mockRows ?? [
    [
      "Today · 17 Feb",
      "Human Computer Interaction",
      "CSC 342",
      "Verified",
      "verified",
    ],
    ["Fri · 14 Feb", "Database Management", "CSC 326", "Late · 11 min", "late"],
    ["Thu · 13 Feb", "Software Engineering", "CSC 318", "Verified", "verified"],
    [
      "Wed · 12 Feb",
      "Human Computer Interaction",
      "CSC 342",
      "Excused",
      "excused",
    ],
    ["Tue · 11 Feb", "Database Management", "CSC 326", "Absent", "absent"],
  ];
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
            <h2>Recent sessions</h2>
            <p>Your attendance across the semester</p>
          </div>
          <select
            className="filter-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option>All courses</option>
            {COURSES.map((c) => (
              <option key={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
        <div className="history-list">
          {historyRows
            .filter((item) => filter === "All courses" || item[2] === filter)
            .map((item) => (
              <div
                className="history-row"
                key={(item[0] ?? "") + (item[2] ?? "")}
              >
                <span className="history-date">{item[0] ?? ""}</span>
                <div className="history-course">
                  <b>{item[1] ?? ""}</b>
                  <span>{item[2] ?? ""}</span>
                </div>
                <span className={`status-chip ${item[4]}`}>
                  <i />
                  {item[3] ?? ""}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
