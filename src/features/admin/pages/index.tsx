import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/lib/apiClient";
import { ApiError, formatApiError } from "@/api/errors";
import type {
  AcademicSessionsResponse,
  CreateAcademicSessionRequest,
  CreateAcademicSessionResponse,
  CreateCourseRequest,
  CreateCourseResponse,
  CreateRoleAssignmentRequest,
  CreateSemesterRequest,
  CreateSemesterResponse,
  CreateVenueRequest,
  CreateVenueResponse,
  DeleteAcademicSessionResponse,
  DeleteSemesterResponse,
  OfferingLecturersResponse,
  ReviewSignupRequest,
  DepartmentCatalogueResponse,
  SearchOfferingsResponse,
  CurrentUser,
  SemestersResponse,
  SignupRequestsResponse,
  StaffImportCommitResponse,
  StaffImportPreview,
  StaffImportRequest,
  SetOfferingLecturersRequest,
  SetOfferingLecturersResponse,
  UpdateAcademicSessionRequest,
  UpdateAcademicSessionResponse,
  UpdateSemesterRequest,
  UpdateSemesterResponse,
  UpdateVenueRequest,
  UpdateVenueResponse,
  VenueListResponse,
} from "@/api/contracts";
import { Icon, PageHeading } from "@/shared/ui/primitives";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

function readObjectField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.getOwnPropertyDescriptor(value, field)?.value;
}

function displayValue(value: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    const field = readObjectField(value, key);
    if (typeof field === "string" && field.trim()) return field;
  }
  return undefined;
}

function readId(value: unknown): string | undefined {
  const id = readObjectField(value, "id");
  return typeof id === "string" && id.trim() ? id : undefined;
}

function csvError(error: unknown): string {
  if (error instanceof ApiError && error.status === 422)
    return "The server found rows that are no longer valid. Review the updated errors before committing again.";
  return formatApiError(error);
}

export function ImportStudents() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StaffImportPreview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"preview" | "commit" | null>(null);

  function selectFile(selected: File | undefined) {
    setError("");
    setMessage("");
    setPreview(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please choose a .csv file.");
      return;
    }
    if (selected.size > MAX_CSV_BYTES) {
      setFile(null);
      setError("That file is larger than the 5 MiB limit.");
      return;
    }
    setFile(selected);
  }

  async function submitImport(commit: boolean) {
    if (!file) return;
    setPending(commit ? "commit" : "preview");
    setError("");
    setMessage("");
    try {
      const csv: StaffImportRequest = await file.text();
      const response = commit
        ? await apiRequest<StaffImportCommitResponse>("/imports/staff", {
            method: "POST",
            headers: { "Content-Type": "text/csv" },
            body: csv,
          })
        : await apiRequest<StaffImportPreview>("/imports/staff/preview", {
            method: "POST",
            headers: { "Content-Type": "text/csv" },
            body: csv,
          });
      setPreview(response);
      if (commit)
        setMessage(
          `${response.rows.length} staff row${response.rows.length === 1 ? "" : "s"} committed with invitations.`,
        );
    } catch (caught) {
      setError(csvError(caught));
    } finally {
      setPending(null);
    }
  }

  const canCommit =
    preview !== null &&
    preview.rows.length > 0 &&
    preview.errors.length === 0 &&
    pending === null;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Import staff"
        subtitle="Preview staff records and lecturer invitations before the atomic commit."
      />
      <section className="panel import-panel">
        <div className="import-drop">
          <span className="import-icon">
            <Icon name="import" size={22} />
          </span>
          <h2>Upload a staff CSV</h2>
          <p>
            Required headers: staff_no, email, display_name, department_id.
            Nothing is created until the final commit.
          </p>
          <label className="button secondary-button file-button">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
          <small>CSV only · Maximum file size 5 MiB</small>
          {file && <span className="selected-file">{file.name}</span>}
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="form-info" role="status">
            {message}
          </div>
        )}
        {file && (
          <div className="import-footer">
            <span>
              {preview
                ? `${preview.rows.length} valid rows · ${preview.errors.length} row errors`
                : "Preview is required before commit"}
            </span>
            <div className="button-row">
              <button
                className="button secondary-button"
                disabled={pending !== null}
                onClick={() => void submitImport(false)}
              >
                {pending === "preview" ? "Checking…" : "Preview import"}
              </button>
              <button
                className="button primary-button"
                disabled={!canCommit}
                onClick={() => void submitImport(true)}
              >
                {pending === "commit" ? "Committing…" : "Commit import"}
              </button>
            </div>
          </div>
        )}
        {preview && (
          <div className="preview-table">
            <h3>
              Preview results{" "}
              <span>
                {preview.rows.length} rows · {preview.errors.length} issues
              </span>
            </h3>
            {preview.rows.map((row) => (
              <div className="preview-row" key={`${row.line}-${row.staff_no}`}>
                <b>Row {row.line}</b>
                <span>{row.display_name}</span>
                <span>{row.email}</span>
                <span className="status-chip verified">
                  <i />
                  Ready
                </span>
              </div>
            ))}
            {preview.errors.map((rowError, index) => (
              <div
                className="preview-row"
                key={`${rowError.line}-${rowError.column ?? index}`}
              >
                <b>Row {rowError.line}</b>
                <span>{rowError.column ?? "CSV"}</span>
                <span>{rowError.message}</span>
                <span className="status-chip late">
                  <i />
                  Needs review
                </span>
              </div>
            ))}
            <small>
              The server revalidates the entire file on commit and writes all
              rows and invitations atomically.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}

export function SignupRequestReview() {
  const [requests, setRequests] = useState<
    NonNullable<SignupRequestsResponse["items"]>
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [level, setLevel] = useState(100);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiRequest<SignupRequestsResponse>(
      "/signup-requests?limit=200&offset=0",
    )
      .then((response) => {
        if (active) setRequests(response.items ?? []);
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

  async function review(status: ReviewSignupRequest["status"]) {
    if (!selectedId) {
      setError("Select a request before reviewing it.");
      return;
    }
    if (
      status === "approved" &&
      (!departmentId.trim() ||
        !programmeId.trim() ||
        !displayName.trim() ||
        !Number.isInteger(level) ||
        level < 1)
    ) {
      setError(
        "Provide the student's name, department, programme and level to approve.",
      );
      return;
    }
    const body: ReviewSignupRequest =
      status === "approved"
        ? {
            status,
            department_id: departmentId.trim(),
            programme_id: programmeId.trim(),
            display_name: displayName.trim(),
            level,
          }
        : { status };
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest<void>(
        `/signup-requests/${encodeURIComponent(selectedId)}/review`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setSelectedId("");
      setMessage(`Signup request ${status}.`);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Signup requests"
        subtitle="Review requests returned within your administrator scope."
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Pending requests</h2>
            <p>Approval creates a student record and an audit event.</p>
          </div>
          <button
            className="text-button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p role="status">Loading signup requests…</p>
        ) : requests.length ? (
          <>
            {requests.map((request, index) => {
              const id = readId(request);
              const label =
                displayValue(request, ["display_name", "name", "matric_no"]) ??
                `Signup request ${index + 1}`;
              const email = displayValue(request, ["email"]);
              return (
                <label className="teaching-row" key={id ?? index}>
                  <span>
                    <input
                      type="radio"
                      name="signup-request"
                      value={id ?? ""}
                      checked={Boolean(id && selectedId === id)}
                      disabled={!id}
                      onChange={() => {
                        if (id) {
                          setSelectedId(id);
                          setDisplayName(
                            displayValue(request, ["display_name", "name"]) ??
                              "",
                          );
                        }
                      }}
                    />
                    <b>{label}</b>
                    {email && <span>{email}</span>}
                  </span>
                  {!id && (
                    <small>Request ID unavailable in API response.</small>
                  )}
                </label>
              );
            })}
            <div className="form-grid">
              <label className="field-label">
                Display name
                <input
                  className="field-control"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label className="field-label">
                Department ID
                <input
                  className="field-control"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                />
              </label>
              <label className="field-label">
                Programme ID
                <input
                  className="field-control"
                  value={programmeId}
                  onChange={(event) => setProgrammeId(event.target.value)}
                />
              </label>
              <label className="field-label">
                Level
                <input
                  className="field-control"
                  type="number"
                  min={1}
                  step={1}
                  value={level}
                  onChange={(event) => setLevel(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="button-row">
              <button
                className="button secondary-button"
                disabled={pending || !selectedId}
                onClick={() => void review("rejected")}
              >
                Reject request
              </button>
              <button
                className="button primary-button"
                disabled={pending || !selectedId}
                onClick={() => void review("approved")}
              >
                {pending ? "Saving…" : "Approve request"}
              </button>
            </div>
          </>
        ) : (
          <p className="empty-state">
            There are no pending signup requests in your scope.
          </p>
        )}
      </section>
    </div>
  );
}

export function VenueAdministration() {
  const [venues, setVenues] = useState<VenueListResponse["items"]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState(60);
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiRequest<VenueListResponse>("/venues?limit=200&offset=0")
      .then((response) => {
        if (active) setVenues(response.items);
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

  function edit(venue: VenueListResponse["items"][number]) {
    setSelectedId(venue.id);
    setName(venue.name);
    setLatitude(String(venue.latitude));
    setLongitude(String(venue.longitude));
    setRadius(venue.radius_meters);
    setDepartmentId(venue.department_id ?? "");
  }

  async function saveVenue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const coordinates = {
      name: name.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius_meters: radius,
      ...(departmentId.trim() ? { department_id: departmentId.trim() } : {}),
    };
    try {
      if (selectedId) {
        const payload: UpdateVenueRequest = coordinates;
        await apiRequest<UpdateVenueResponse>(
          `/venues/${encodeURIComponent(selectedId)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setMessage("Venue updated.");
      } else {
        const payload: CreateVenueRequest = coordinates;
        await apiRequest<CreateVenueResponse>("/venues", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Venue created.");
      }
      setSelectedId("");
      setName("");
      setLatitude("");
      setLongitude("");
      setRadius(60);
      setDepartmentId("");
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function deactivate(id: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest<void>(`/venues/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setMessage("Venue deactivated.");
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Venues"
        subtitle="Create and maintain venues within your administrator scope."
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Venue catalogue</h2>
            <p>Inactive venues remain in attendance history.</p>
          </div>
        </div>
        {loading ? (
          <p role="status">Loading venues…</p>
        ) : venues.length ? (
          venues.map((venue) => (
            <div className="teaching-row" key={venue.id}>
              <div>
                <b>{venue.name}</b>
                <span>
                  {venue.latitude}, {venue.longitude} · {venue.radius_meters} m
                </span>
                <span>{venue.active ? "Active" : "Inactive"}</span>
              </div>
              <div className="button-row">
                <button className="text-button" onClick={() => edit(venue)}>
                  Edit
                </button>
                {venue.active && (
                  <button
                    className="text-button"
                    disabled={pending}
                    onClick={() => void deactivate(venue.id)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No venues are available in your scope.</p>
        )}
      </section>
      <form
        className="panel page-stack"
        onSubmit={(event) => void saveVenue(event)}
      >
        <h2>{selectedId ? "Update venue" : "Create venue"}</h2>
        <label className="field-label">
          Venue name
          <input
            className="field-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Latitude
            <input
              className="field-control"
              type="number"
              step="any"
              min={-90}
              max={90}
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Longitude
            <input
              className="field-control"
              type="number"
              step="any"
              min={-180}
              max={180}
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Radius (meters)
            <input
              className="field-control"
              type="number"
              min={1}
              step={1}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              required
            />
          </label>
          <label className="field-label">
            Department ID (optional)
            <input
              className="field-control"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="button primary-button"
            type="submit"
            disabled={pending}
          >
            {pending ? "Saving…" : selectedId ? "Save venue" : "Create venue"}
          </button>
          {selectedId && (
            <button
              className="button secondary-button"
              type="button"
              onClick={() => {
                setSelectedId("");
                setName("");
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function AcademicCalendar() {
  const [sessions, setSessions] = useState<AcademicSessionsResponse["items"]>(
    [],
  );
  const [semesters, setSemesters] = useState<SemestersResponse["items"]>([]);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [current, setCurrent] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [editingSemesterId, setEditingSemesterId] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [semesterStartsOn, setSemesterStartsOn] = useState("");
  const [semesterEndsOn, setSemesterEndsOn] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      apiRequest<AcademicSessionsResponse>(
        "/academic-sessions?limit=200&offset=0",
      ),
      apiRequest<SemestersResponse>("/semesters?limit=200&offset=0"),
    ])
      .then(([sessionResponse, semesterResponse]) => {
        if (!active) return;
        setSessions(sessionResponse.items);
        setSemesters(semesterResponse.items);
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

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: CreateAcademicSessionRequest = {
      name: name.trim(),
      starts_on: startsOn,
      ends_on: endsOn,
      current,
    };
    await mutate(
      "/academic-sessions",
      "POST",
      payload,
      "Academic session created.",
    );
    setName("");
    setStartsOn("");
    setEndsOn("");
    setCurrent(false);
  }

  async function createSemester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionId) {
      setError("Select an academic session first.");
      return;
    }
    if (editingSemesterId) {
      const payload: UpdateSemesterRequest = {
        academic_session_id: sessionId,
        name: semesterName.trim(),
        starts_on: semesterStartsOn,
        ends_on: semesterEndsOn,
      };
      await mutate(
        `/semesters/${encodeURIComponent(editingSemesterId)}`,
        "PATCH",
        payload,
        "Semester updated.",
      );
      setEditingSemesterId("");
    } else {
      const payload: CreateSemesterRequest = {
        academic_session_id: sessionId,
        name: semesterName.trim(),
        starts_on: semesterStartsOn,
        ends_on: semesterEndsOn,
      };
      await mutate("/semesters", "POST", payload, "Semester created.");
    }
    setSemesterName("");
    setSemesterStartsOn("");
    setSemesterEndsOn("");
  }

  function editSemester(item: SemestersResponse["items"][number]) {
    const parentSessionId = readObjectField(item, "academic_session_id");
    setEditingSemesterId(item.id);
    setSessionId(typeof parentSessionId === "string" ? parentSessionId : "");
    setSemesterName(displayValue(item, ["name", "title", "code"]) ?? "");
    setSemesterStartsOn(displayValue(item, ["starts_on"]) ?? "");
    setSemesterEndsOn(displayValue(item, ["ends_on"]) ?? "");
  }

  async function mutate(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    payload:
      | CreateAcademicSessionRequest
      | UpdateAcademicSessionRequest
      | CreateSemesterRequest
      | UpdateSemesterRequest,
    successMessage: string,
  ) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (method === "POST" && path === "/academic-sessions")
        await apiRequest<CreateAcademicSessionResponse>(path, {
          method,
          body: JSON.stringify(payload),
        });
      else if (method === "POST")
        await apiRequest<CreateSemesterResponse>(path, {
          method,
          body: JSON.stringify(payload),
        });
      else if (method === "PATCH" && path.startsWith("/academic-sessions/"))
        await apiRequest<UpdateAcademicSessionResponse>(path, {
          method,
          body: JSON.stringify(payload),
        });
      else if (method === "PATCH")
        await apiRequest<UpdateSemesterResponse>(path, {
          method,
          body: JSON.stringify(payload),
        });
      else if (path.startsWith("/academic-sessions/"))
        await apiRequest<DeleteAcademicSessionResponse>(path, { method });
      else await apiRequest<DeleteSemesterResponse>(path, { method });
      setMessage(successMessage);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function updateSession(id: string) {
    const payload: UpdateAcademicSessionRequest = { current: true };
    await mutate(
      `/academic-sessions/${encodeURIComponent(id)}`,
      "PATCH",
      payload,
      "Current academic session updated.",
    );
  }

  async function deleteItem(path: string, label: string) {
    await mutate(path, "DELETE", {}, `${label} deleted.`);
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Academic calendar"
        subtitle="Maintain academic sessions and their semesters."
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      {loading ? (
        <p role="status">Loading academic calendar…</p>
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Academic sessions</h2>
                <p>Dates and current-session state are returned by the API.</p>
              </div>
            </div>
            {sessions.length ? (
              sessions.map((item) => (
                <div className="teaching-row" key={item.id}>
                  <div>
                    <b>
                      {displayValue(item, ["name", "title", "code"]) ??
                        `Session ${item.id}`}
                    </b>
                    <span>
                      {displayValue(item, ["starts_on"]) ??
                        "Start date unavailable"}{" "}
                      –{" "}
                      {displayValue(item, ["ends_on"]) ??
                        "End date unavailable"}
                    </span>
                  </div>
                  <div className="button-row">
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() => void updateSession(item.id)}
                    >
                      Set current
                    </button>
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() =>
                        void deleteItem(
                          `/academic-sessions/${encodeURIComponent(item.id)}`,
                          "Academic session",
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No academic sessions have been created.
              </p>
            )}
          </section>
          <form
            className="panel page-stack"
            onSubmit={(event) => void createSession(event)}
          >
            <h2>Create academic session</h2>
            <label className="field-label">
              Name
              <input
                className="field-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <div className="form-grid">
              <label className="field-label">
                Starts on
                <input
                  className="field-control"
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Ends on
                <input
                  className="field-control"
                  type="date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="session-option">
              <input
                type="checkbox"
                checked={current}
                onChange={(event) => setCurrent(event.target.checked)}
              />
              Set as current session
            </label>
            <button className="button primary-button" disabled={pending}>
              {pending ? "Saving…" : "Create session"}
            </button>
          </form>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Semesters</h2>
                <p>Each semester belongs to an academic session.</p>
              </div>
            </div>
            {semesters.length ? (
              semesters.map((item) => (
                <div className="teaching-row" key={item.id}>
                  <div>
                    <b>
                      {displayValue(item, ["name", "title", "code"]) ??
                        `Semester ${item.id}`}
                    </b>
                    <span>
                      {displayValue(item, ["starts_on"]) ?? ""} –{" "}
                      {displayValue(item, ["ends_on"]) ?? ""}
                    </span>
                  </div>
                  <div className="button-row">
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() => editSemester(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() =>
                        void deleteItem(
                          `/semesters/${encodeURIComponent(item.id)}`,
                          "Semester",
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No semesters have been created.</p>
            )}
          </section>
          <form
            className="panel page-stack"
            onSubmit={(event) => void createSemester(event)}
          >
            <h2>{editingSemesterId ? "Update semester" : "Create semester"}</h2>
            <label className="field-label">
              Academic session
              <select
                className="field-control"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                required
              >
                <option value="">Choose a session</option>
                {sessions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {displayValue(item, ["name", "title", "code"]) ?? item.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Name
              <input
                className="field-control"
                value={semesterName}
                onChange={(event) => setSemesterName(event.target.value)}
                required
              />
            </label>
            <div className="form-grid">
              <label className="field-label">
                Starts on
                <input
                  className="field-control"
                  type="date"
                  value={semesterStartsOn}
                  onChange={(event) => setSemesterStartsOn(event.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Ends on
                <input
                  className="field-control"
                  type="date"
                  value={semesterEndsOn}
                  onChange={(event) => setSemesterEndsOn(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="button-row">
              <button
                className="button primary-button"
                disabled={pending || !sessions.length}
              >
                {pending
                  ? "Saving…"
                  : editingSemesterId
                    ? "Save semester"
                    : "Create semester"}
              </button>
              {editingSemesterId && (
                <button
                  className="button secondary-button"
                  type="button"
                  onClick={() => setEditingSemesterId("")}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export function RoleAssignment() {
  const [userId, setUserId] = useState("");
  const [scopeType, setScopeType] =
    useState<CreateRoleAssignmentRequest["scope_type"]>("department");
  const [scopeId, setScopeId] = useState("");
  const [role, setRole] =
    useState<CreateRoleAssignmentRequest["role"]>("department_admin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const payload: CreateRoleAssignmentRequest = {
      user_id: userId.trim(),
      role,
      scope_type: scopeType,
      ...(scopeType === "department"
        ? { department_id: scopeId.trim() }
        : { faculty_id: scopeId.trim() }),
    };
    try {
      await apiRequest<void>("/role-assignments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage("Administrator role assigned and audit event recorded.");
      setUserId("");
      setScopeId("");
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Administrator roles"
        subtitle="Assign a department or faculty administrator role within your authority."
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-info" role="status">
          {message}
        </div>
      )}
      <form
        className="panel page-stack"
        onSubmit={(event) => void assign(event)}
      >
        <label className="field-label">
          User ID
          <input
            className="field-control"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Role
            <select
              className="field-control"
              value={role}
              onChange={(event) => {
                const nextRole = event.target
                  .value as CreateRoleAssignmentRequest["role"];
                setRole(nextRole);
                setScopeType(
                  nextRole === "department_admin" ? "department" : "faculty",
                );
              }}
            >
              <option value="department_admin">Department administrator</option>
              <option value="faculty_admin">Faculty administrator</option>
            </select>
          </label>
          <label className="field-label">
            Scope
            <select
              className="field-control"
              value={scopeType}
              onChange={(event) =>
                setScopeType(
                  event.target
                    .value as CreateRoleAssignmentRequest["scope_type"],
                )
              }
            >
              <option value="department">Department</option>
              <option value="faculty">Faculty</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          {scopeType === "department" ? "Department ID" : "Faculty ID"}
          <input
            className="field-control"
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value)}
            required
          />
        </label>
        <p>
          The backend validates that the requested role and scope are within the
          signed-in administrator's authority.
        </p>
        <button className="button primary-button" disabled={pending}>
          {pending ? "Assigning…" : "Assign role"}
        </button>
      </form>
    </div>
  );
}

export function CoursesAndOfferings({ user }: { user: CurrentUser }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [departments, setDepartments] = useState<
    DepartmentCatalogueResponse["items"]
  >([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState("");
  const [departmentReloadKey, setDepartmentReloadKey] = useState(0);
  const [departmentId, setDepartmentId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseKind, setCourseKind] =
    useState<CreateCourseRequest["kind"]>("departmental");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseCredits, setCourseCredits] = useState("");
  const [coursePending, setCoursePending] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [courseMessage, setCourseMessage] = useState("");
  const [managedOffering, setManagedOffering] = useState<
    SearchOfferingsResponse["items"][number] | null
  >(null);
  const [assignedLecturers, setAssignedLecturers] =
    useState<OfferingLecturersResponse>([]);
  const [lecturerAccountId, setLecturerAccountId] = useState("");
  const [lecturersLoading, setLecturersLoading] = useState(false);
  const [lecturersReady, setLecturersReady] = useState(false);
  const [lecturerPending, setLecturerPending] = useState(false);
  const [lecturerError, setLecturerError] = useState("");
  const [lecturerMessage, setLecturerMessage] = useState("");
  const [offerings, setOfferings] = useState<SearchOfferingsResponse["items"]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const departmentAdminRole = user.roles.find(
    (role) =>
      role.role === "department_admin" && role.scope_type === "department",
  );
  const scopedDepartmentId =
    departmentAdminRole?.department_id ??
    departmentAdminRole?.scope_id ??
    undefined;

  useEffect(() => {
    if (scopedDepartmentId) {
      setDepartmentId(scopedDepartmentId);
      return;
    }
    let active = true;
    setDepartmentsLoading(true);
    setDepartmentsError("");
    void apiRequest<DepartmentCatalogueResponse>(
      "/departments?limit=200&offset=0",
    )
      .then(async (firstPage) => {
        const items = [...firstPage.items];
        let offset = items.length;
        let hasMore = firstPage.has_more;
        while (hasMore && active) {
          const page = await apiRequest<DepartmentCatalogueResponse>(
            `/departments?limit=200&offset=${offset}`,
          );
          items.push(...page.items);
          offset += page.items.length;
          hasMore = page.has_more && page.items.length > 0;
        }
        if (active) {
          setDepartments(items);
          if (items.length > 0) {
            const firstId = readId(items[0]);
            if (firstId) setDepartmentId(firstId);
          }
        }
      })
      .catch((caught: unknown) => {
        if (active) setDepartmentsError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setDepartmentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [departmentReloadKey, scopedDepartmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const items: SearchOfferingsResponse["items"] = [];
        let offset = 0;
        while (true) {
          const params = new URLSearchParams({
            q: debouncedQuery,
            limit: "200",
            offset: String(offset),
          });
          const page = await apiRequest<SearchOfferingsResponse>(
            `/offerings/search?${params}`,
          );
          items.push(...page.items);
          if (!page.has_more || page.items.length === 0) break;
          offset += page.items.length;
        }
        if (active) setOfferings(items);
      } catch (caught) {
        if (active) setError(formatApiError(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [debouncedQuery, reloadKey]);

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCoursePending(true);
    setCourseError("");
    setCourseMessage("");
    const payload: CreateCourseRequest = {
      department_id: departmentId,
      code: courseCode.trim(),
      title: courseTitle.trim(),
      ...(courseKind ? { kind: courseKind } : {}),
      ...(courseDescription.trim()
        ? { description: courseDescription.trim() }
        : {}),
      ...(courseCredits !== "" ? { credits: Number(courseCredits) } : {}),
    };
    try {
      await apiRequest<CreateCourseResponse>("/courses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCourseMessage(`${payload.code} — ${payload.title} was created.`);
      setCourseCode("");
      setCourseTitle("");
      setCourseDescription("");
      setCourseCredits("");
    } catch (caught) {
      setCourseError(formatApiError(caught));
    } finally {
      setCoursePending(false);
    }
  }

  async function openLecturerManager(
    offering: SearchOfferingsResponse["items"][number],
  ) {
    setManagedOffering(offering);
    setAssignedLecturers([]);
    setLecturerAccountId("");
    setLecturerError("");
    setLecturerMessage("");
    setLecturersLoading(true);
    setLecturersReady(false);
    try {
      const current = await apiRequest<OfferingLecturersResponse>(
        `/offerings/${encodeURIComponent(offering.offering_id)}/lecturers`,
      );
      setAssignedLecturers(current);
      setLecturersReady(true);
    } catch (caught) {
      setLecturerError(formatApiError(caught));
    } finally {
      setLecturersLoading(false);
    }
  }

  async function addOfferingLecturer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedOffering) return;
    const id = lecturerAccountId.trim();
    if (assignedLecturers.some((lecturer) => lecturer.id === id)) {
      setLecturerError("That lecturer is already assigned to this offering.");
      return;
    }
    setLecturerPending(true);
    setLecturerError("");
    setLecturerMessage("");
    const existingLecturerIds = assignedLecturers.map(
      ({ id: lecturerId }) => lecturerId,
    );
    const payload: SetOfferingLecturersRequest = {
      lecturer_ids: [...existingLecturerIds, id],
    };
    try {
      const updated = await apiRequest<SetOfferingLecturersResponse>(
        `/offerings/${encodeURIComponent(managedOffering.offering_id)}/lecturers`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      setAssignedLecturers(
        updated.lecturer_ids.map(
          (lecturerId) =>
            assignedLecturers.find(
              ({ id: currentId }) => currentId === lecturerId,
            ) ??
            { id: lecturerId, display_name: lecturerId, email: "" },
        ),
      );
      setLecturersReady(true);
      setLecturerAccountId("");
      setLecturerMessage("Lecturer added to this offering.");
      setReloadKey((key) => key + 1);
      try {
        const current = await apiRequest<OfferingLecturersResponse>(
          `/offerings/${encodeURIComponent(managedOffering.offering_id)}/lecturers`,
        );
        setAssignedLecturers(current);
      } catch (caught) {
        setLecturerError(
          `Lecturer was added, but the assigned lecturer details could not be refreshed: ${formatApiError(caught)}`,
        );
      }
    } catch (caught) {
      setLecturerError(formatApiError(caught));
    } finally {
      setLecturerPending(false);
    }
  }

  const departmentOptions = scopedDepartmentId
    ? [{ id: scopedDepartmentId, name: "Your department" }]
    : departments.flatMap((department) => {
        const id = readId(department);
        const name = displayValue(department, ["name", "title"]) ?? id;
        return id && name ? [{ id, name }] : [];
      });

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Courses & offerings"
        subtitle={`Courses and offerings visible to ${user.name}'s administrator scope, with their assigned lecturers.`}
      />
      <section className="panel">
        <h2>Create a course</h2>
        <p className="admin-offering-note">
          Course creation is limited by your administrator scope. The backend
          validates that the selected department is within that scope.
        </p>
        {courseError && (
          <div className="form-error" role="alert">
            {courseError}
          </div>
        )}
        {courseMessage && (
          <div className="form-info" role="status">
            {courseMessage}
          </div>
        )}
        {departmentsError && (
          <div className="api-state-error" role="alert">
            <p>{departmentsError}</p>
            <button
              className="text-button"
              onClick={() => setDepartmentReloadKey((key) => key + 1)}
              type="button"
            >
              Retry departments
            </button>
          </div>
        )}
        <form className="admin-course-form" onSubmit={createCourse}>
          <label className="field-label">
            Department
            <select
              className="field-control"
              required
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              disabled={
                departmentsLoading ||
                coursePending ||
                departmentOptions.length === 0
              }
            >
              {departmentOptions.length === 0 && (
                <option value="">
                  {departmentsLoading
                    ? "Loading departments…"
                    : "No departments available"}
                </option>
              )}
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Course code
            <input
              className="field-control"
              required
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
            />
          </label>
          <label className="field-label">
            Course title
            <input
              className="field-control"
              required
              value={courseTitle}
              onChange={(event) => setCourseTitle(event.target.value)}
            />
          </label>
          <label className="field-label">
            Course kind
            <select
              className="field-control"
              value={courseKind}
              onChange={(event) =>
                setCourseKind(
                  event.target.value === "general" ? "general" : "departmental",
                )
              }
            >
              <option value="departmental">Departmental</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="field-label">
            Credits (optional)
            <input
              className="field-control"
              type="number"
              min="0"
              step="1"
              value={courseCredits}
              onChange={(event) => setCourseCredits(event.target.value)}
            />
          </label>
          <label className="field-label admin-course-description">
            Description (optional)
            <textarea
              className="field-control"
              value={courseDescription}
              onChange={(event) => setCourseDescription(event.target.value)}
              rows={3}
            />
          </label>
          <button
            className="button primary-button"
            disabled={
              coursePending ||
              departmentsLoading ||
              departmentOptions.length === 0
            }
            type="submit"
          >
            {coursePending ? "Creating course…" : "Create course"}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Existing offerings</h2>
        <label className="search-field admin-offering-search">
          <Icon name="search" />
          <input
            aria-label="Search courses and lecturers"
            placeholder="Search by course, department, or lecturer…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="admin-offering-note">
          Lecturer names are shown for each offering. This is not a directory of
          staff who have no course assignments.
        </p>
        {loading ? (
          <p role="status">Loading scoped courses and offerings…</p>
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
          <div className="admin-offering-list">
            {offerings.map((offering) => (
              <article
                className="admin-offering-row"
                key={offering.offering_id}
              >
                <div>
                  <h2>
                    {offering.course_code} · {offering.course_title}
                  </h2>
                  <p>
                    {offering.department_name} · Level {offering.level} ·{" "}
                    {offering.kind === "general" ? "General" : "Departmental"}
                    {offering.semester ? ` · ${offering.semester}` : ""}
                  </p>
                </div>
                <div className="admin-offering-lecturers">
                  <b>Lecturers</b>
                  <span>
                    {offering.lecturers.length
                      ? offering.lecturers.join(", ")
                      : "No lecturers assigned"}
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void openLecturerManager(offering)}
                    aria-label={`Manage lecturers for ${offering.course_code}`}
                  >
                    {managedOffering?.offering_id === offering.offering_id
                      ? "Refresh lecturers"
                      : "Manage lecturers"}
                  </button>
                </div>
                {managedOffering?.offering_id === offering.offering_id && (
                  <div className="admin-lecturer-manager">
                    <div className="panel-heading">
                      <div>
                        <h3>Assigned lecturers</h3>
                        <p>
                          Enter the lecturer’s account UUID. This is not a
                          student number.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setManagedOffering(null);
                          setLecturerError("");
                          setLecturerMessage("");
                        }}
                      >
                        Close
                      </button>
                    </div>
                    {lecturerError && (
                      <div className="form-error" role="alert">
                        {lecturerError}
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void openLecturerManager(offering)}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {lecturerMessage && (
                      <p className="form-info" role="status">
                        {lecturerMessage}
                      </p>
                    )}
                    {lecturersLoading ? (
                      <p role="status">Loading assigned lecturers…</p>
                    ) : !lecturersReady ? (
                      <p>
                        Load the current assignments before adding a lecturer
                        so existing assignments are preserved.
                      </p>
                    ) : (
                      <>
                        {assignedLecturers.length ? (
                          <ul className="admin-assigned-lecturers">
                            {assignedLecturers.map((lecturer) => (
                              <li key={lecturer.id}>
                                <b>{lecturer.display_name}</b>
                                <span>{lecturer.email}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty-state">
                            No lecturers are assigned to this offering.
                          </p>
                        )}
                        <form
                          className="admin-add-lecturer-form"
                          onSubmit={(event) =>
                            void addOfferingLecturer(event)
                          }
                        >
                          <label className="field-label">
                            Lecturer account UUID
                            <input
                              className="field-control"
                              value={lecturerAccountId}
                              onChange={(event) =>
                                setLecturerAccountId(event.target.value)
                              }
                              required
                            />
                          </label>
                          <button
                            className="button secondary-button"
                            disabled={lecturerPending}
                          >
                            {lecturerPending
                              ? "Adding lecturer…"
                              : "Add lecturer"}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {debouncedQuery
              ? "No courses or offerings match your search in this administrator scope."
              : "No courses or offerings were found in this administrator scope."}
          </p>
        )}
      </section>
    </div>
  );
}
