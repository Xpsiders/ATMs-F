import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/lib/apiClient";
import { ApiError, formatApiError, presentApiError } from "@/api/errors";
import { tryGetCurrentPosition } from "@/shared/lib/geo";
import type {
  AcademicSessionsResponse,
  CatalogueItem,
  CatalogueListResponse,
  CreateOfferingRequest,
  CreateOfferingResponse,
  CreateAcademicSessionRequest,
  CreateAcademicSessionResponse,
  CreateCourseRequest,
  CreateCourseResponse,
  CreateRoleAssignmentRequest,
  CreateSemesterRequest,
  CreateSemesterResponse,
  CaptureVenueLocationRequest,
  CaptureVenueLocationResponse,
  CreateVenueRequest,
  CreateVenueResponse,
  DeviceListItem,
  DevicePairingCode,
  DevicesResponse,
  EnqueueEnrolmentResponse,
  ProvisionedDevice,
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
  TeachingRequestsResponse,
  ReviewTeachingRequestRequest,
  UpdateAcademicSessionRequest,
  UpdateAcademicSessionResponse,
  UpdateSemesterRequest,
  UpdateSemesterResponse,
  UpdateVenueRequest,
  UpdateVenueResponse,
  VenueListResponse,
} from "@/api/contracts";
import { Icon, type IconName, PageHeading } from "@/shared/ui/primitives";
import { UserSearchSelect } from "@/shared/ui/UserSearchSelect";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const NEW_COURSE_OPTION = "__new_course__";

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

async function loadCatalogueItems(path: string): Promise<CatalogueItem[]> {
  const items: CatalogueItem[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await apiRequest<CatalogueListResponse>(
      `${path}?limit=200&offset=${offset}`,
    );
    items.push(...page.items);
    offset += page.items.length;
    hasMore = page.has_more && page.items.length > 0;
  }
  return items;
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

export function TeachingRequestsReview() {
  const [requests, setRequests] = useState<TeachingRequestsResponse["items"]>(
    [],
  );
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiRequest<TeachingRequestsResponse>(
      "/teaching-requests?limit=200&offset=0",
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

  async function review(status: ReviewTeachingRequestRequest["status"]) {
    if (!selectedId) {
      setError("Select a teaching request before reviewing it.");
      return;
    }
    const body: ReviewTeachingRequestRequest = { status };
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest<void>(
        `/teaching-requests/${encodeURIComponent(selectedId)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setSelectedId("");
      setMessage(
        status === "approved"
          ? "Teaching request approved; the offering has been created."
          : "Teaching request rejected.",
      );
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
        title="Teaching requests"
        subtitle="Review cross-department teaching requests within your administrator scope."
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
            <p>Approval creates the offering and assigns the lecturer.</p>
          </div>
          <button
            className="text-button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p role="status">Loading teaching requests…</p>
        ) : requests.length ? (
          <>
            {requests.map((request, index) => {
              const id = request.id;
              const courseLabel =
                [request.course_code, request.course_title]
                  .filter((part) => part && part.trim())
                  .join(" — ") || `Teaching request ${index + 1}`;
              return (
                <label className="teaching-row" key={id ?? index}>
                  <span>
                    <input
                      type="radio"
                      name="teaching-request"
                      value={id ?? ""}
                      checked={Boolean(id && selectedId === id)}
                      disabled={!id}
                      onChange={() => {
                        if (id) setSelectedId(id);
                      }}
                    />
                    <b>{courseLabel}</b>
                    {request.lecturer_name && (
                      <span>{request.lecturer_name}</span>
                    )}
                  </span>
                  <span className="status-pill status-pending">
                    <Icon name="clock" size={13} />
                    {request.status ? request.status : "pending"}
                  </span>
                  {!id && (
                    <small>Request ID unavailable in API response.</small>
                  )}
                </label>
              );
            })}
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
            There are no pending teaching requests in your scope.
          </p>
        )}
      </section>
    </div>
  );
}

const DEVICE_STATUS_META: Record<
  DeviceListItem["status"],
  { label: string; className: string; icon: IconName }
> = {
  unpaired: {
    label: "Awaiting pairing",
    className: "status-unpaired",
    icon: "clock",
  },
  active: { label: "Active", className: "status-active", icon: "check" },
  revoked: { label: "Revoked", className: "status-revoked", icon: "dispute" },
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "unknown";
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  return new Date(ts).toLocaleDateString();
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString();
}

export function ScannerAdministration() {
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [venues, setVenues] = useState<VenueListResponse["items"]>([]);
  const [canProvision, setCanProvision] = useState(true);
  const [scopeDenied, setScopeDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [provisionVenueId, setProvisionVenueId] = useState("");
  const [provisionName, setProvisionName] = useState("");
  const [provisioning, setProvisioning] = useState(false);

  const [pairing, setPairing] = useState<DevicePairingCode | null>(null);
  const [pairingContext, setPairingContext] = useState("");
  const [copied, setCopied] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    kind: "rotate" | "revoke";
    device: DeviceListItem;
  } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [enrolOpenId, setEnrolOpenId] = useState("");
  const [enrolStudentId, setEnrolStudentId] = useState("");
  const [enrolPending, setEnrolPending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setScopeDenied(false);
    void apiRequest<DevicesResponse>("/devices?limit=100&offset=0")
      .then((response) => {
        if (active) setDevices(response.items ?? []);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 403)
          setScopeDenied(true);
        else setError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    void apiRequest<VenueListResponse>("/venues?limit=200&offset=0")
      .then((response) => {
        if (!active) return;
        setVenues((response.items ?? []).filter((venue) => venue.active));
        setCanProvision(true);
      })
      .catch((caught: unknown) => {
        if (active && caught instanceof ApiError && caught.status === 403)
          setCanProvision(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function openPairing(code: DevicePairingCode, context: string) {
    setPairing(code);
    setPairingContext(context);
    setCopied(false);
  }

  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provisionVenueId) {
      setError("Select a venue for the scanner.");
      return;
    }
    setProvisioning(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<ProvisionedDevice>("/devices", {
        method: "POST",
        body: JSON.stringify({
          venue_id: provisionVenueId,
          name: provisionName.trim(),
        }),
      });
      openPairing(
        result.pairing,
        `New scanner “${result.device.name}” at ${result.device.venue_name}`,
      );
      setProvisionName("");
      setProvisionVenueId("");
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setProvisioning(false);
    }
  }

  async function issuePairingCode(device: DeviceListItem) {
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      const code = await apiRequest<DevicePairingCode>(
        `/devices/${encodeURIComponent(device.id)}/pairing-code`,
        { method: "POST" },
      );
      openPairing(code, `New pairing code for “${device.name}”`);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setActionPending(false);
    }
  }

  async function runConfirm() {
    if (!confirmAction) return;
    const { kind, device } = confirmAction;
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      if (kind === "rotate") {
        const code = await apiRequest<DevicePairingCode>(
          `/devices/${encodeURIComponent(device.id)}/rotate-key`,
          { method: "POST" },
        );
        setConfirmAction(null);
        openPairing(
          code,
          `Re-pair “${device.name}” — the scanner stays offline until it pairs with this code`,
        );
      } else {
        await apiRequest<void>(`/devices/${encodeURIComponent(device.id)}`, {
          method: "DELETE",
        });
        setConfirmAction(null);
        setMessage(`“${device.name}” was revoked.`);
      }
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
      setConfirmAction(null);
    } finally {
      setActionPending(false);
    }
  }

  async function enrol(device: DeviceListItem) {
    if (!enrolStudentId) {
      setError("Select a student to enrol.");
      return;
    }
    setEnrolPending(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<EnqueueEnrolmentResponse>(
        `/devices/${encodeURIComponent(device.id)}/enrolments`,
        {
          method: "POST",
          body: JSON.stringify({ student_record_id: enrolStudentId }),
        },
      );
      setMessage(
        `Queued on slot ${result.slot_number} — have the student place their finger on “${device.name}”. The scanner enrols them automatically.`,
      );
      setEnrolStudentId("");
      setEnrolOpenId("");
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setEnrolPending(false);
    }
  }

  async function copyCode() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.pairing_code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SCOPED ADMINISTRATION"
        title="Scanners"
        subtitle="Provision and manage fingerprint scanners for venues in your scope."
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
      {scopeDenied ? (
        <section className="panel">
          <p className="empty-state">
            You don't have access to manage scanners. Ask an administrator with
            authority over the venue's department, or a venue where you teach.
          </p>
        </section>
      ) : (
        <>
          {canProvision && (
            <form
              className="panel page-stack"
              onSubmit={(event) => void provision(event)}
            >
              <div>
                <h2>Provision a scanner</h2>
                <p>
                  Register a scanner for a venue. A one-time pairing code is shown
                  once — flash it into the device firmware.
                </p>
              </div>
              <div className="form-grid">
                <label className="field-label">
                  Venue
                  <select
                    className="field-control"
                    value={provisionVenueId}
                    onChange={(event) => setProvisionVenueId(event.target.value)}
                    required
                  >
                    <option value="">Select a venue…</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Scanner name
                  <input
                    className="field-control"
                    value={provisionName}
                    onChange={(event) => setProvisionName(event.target.value)}
                    required
                    maxLength={120}
                    placeholder="e.g. LT 2 entrance scanner"
                  />
                </label>
              </div>
              <div className="button-row">
                <button
                  className="button primary-button"
                  type="submit"
                  disabled={provisioning}
                >
                  {provisioning ? "Provisioning…" : "Provision scanner"}
                </button>
              </div>
            </form>
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Scanners</h2>
                <p>
                  Attendance captured by these scanners appears in the usual
                  session reports for the assigned lecturer.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <p role="status">Loading scanners…</p>
            ) : devices.length ? (
              devices.map((device) => {
                const meta = DEVICE_STATUS_META[device.status];
                const health: string[] = [];
                if (device.firmware_version)
                  health.push(`Firmware ${device.firmware_version}`);
                if (typeof device.battery_percent === "number")
                  health.push(`Battery ${device.battery_percent}%`);
                if (typeof device.pending_queue_depth === "number")
                  health.push(`Queue ${device.pending_queue_depth}`);
                const expiry = formatExpiry(device.pairing_code_expires_at);
                return (
                  <div className="teaching-row device-row" key={device.id}>
                    <div className="device-main">
                      <b>{device.name}</b>
                      <span>{device.venue_name}</span>
                      <span>Last seen {formatRelative(device.last_seen_at)}</span>
                      {health.length > 0 && <span>{health.join(" · ")}</span>}
                      {device.status !== "revoked" && expiry && (
                        <span>Pairing code pending (expires {expiry})</span>
                      )}
                      {enrolOpenId === device.id && (
                        <div className="device-enrol">
                          <UserSearchSelect
                            label="Student to enrol"
                            value={enrolStudentId}
                            onChange={setEnrolStudentId}
                            role="student"
                            hint="Search the directory for the student to enrol on this scanner."
                          />
                          <div className="button-row">
                            <button
                              className="button primary-button"
                              type="button"
                              disabled={enrolPending || !enrolStudentId}
                              onClick={() => void enrol(device)}
                            >
                              {enrolPending ? "Queuing…" : "Queue enrolment"}
                            </button>
                            <button
                              className="button secondary-button"
                              type="button"
                              onClick={() => {
                                setEnrolOpenId("");
                                setEnrolStudentId("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="device-side">
                      <span className={`status-pill ${meta.className}`}>
                        <Icon name={meta.icon} size={13} />
                        {meta.label}
                      </span>
                      {device.status !== "revoked" && (
                        <div className="button-row">
                          {device.status === "unpaired" && (
                            <button
                              className="text-button"
                              disabled={actionPending}
                              onClick={() => void issuePairingCode(device)}
                            >
                              Issue pairing code
                            </button>
                          )}
                          {device.status === "active" && (
                            <button
                              className="text-button"
                              disabled={actionPending}
                              onClick={() =>
                                setConfirmAction({ kind: "rotate", device })
                              }
                            >
                              Rotate key
                            </button>
                          )}
                          <button
                            className="text-button"
                            onClick={() => {
                              setEnrolStudentId("");
                              setEnrolOpenId(
                                enrolOpenId === device.id ? "" : device.id,
                              );
                            }}
                          >
                            {enrolOpenId === device.id
                              ? "Close enrolment"
                              : "Enrol student"}
                          </button>
                          <button
                            className="text-button"
                            disabled={actionPending}
                            onClick={() =>
                              setConfirmAction({ kind: "revoke", device })
                            }
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty-state">
                No scanners are registered in your scope yet.
              </p>
            )}
          </section>
        </>
      )}
      {pairing && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pairing-title"
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => setPairing(null)}
            >
              ×
            </button>
            <h2 id="pairing-title">Pairing code</h2>
            <p>{pairingContext}</p>
            <div className="pairing-code" aria-label="Pairing code">
              {pairing.pairing_code}
            </div>
            <p className="pairing-note">
              Flash this code into the scanner firmware. It will not be shown
              again.
              {pairing.pairing_code_expires_at &&
                ` Expires ${formatExpiry(pairing.pairing_code_expires_at)}.`}
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary-button"
                type="button"
                onClick={() => void copyCode()}
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                className="button primary-button"
                type="button"
                onClick={() => setPairing(null)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
      {confirmAction && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-confirm-title"
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => setConfirmAction(null)}
            >
              ×
            </button>
            <h2 id="device-confirm-title">
              {confirmAction.kind === "rotate"
                ? `Rotate the key for “${confirmAction.device.name}”?`
                : `Revoke “${confirmAction.device.name}”?`}
            </h2>
            <p>
              {confirmAction.kind === "rotate"
                ? "The scanner will stop working until it is re-paired with the new code."
                : "The scanner's key is rejected immediately. Its records stay for reporting."}
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary-button"
                type="button"
                disabled={actionPending}
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={actionPending}
                onClick={() => void runConfirm()}
              >
                {actionPending
                  ? "Working…"
                  : confirmAction.kind === "rotate"
                    ? "Rotate key"
                    : "Revoke scanner"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function VenueAdministration() {
  const [venues, setVenues] = useState<VenueListResponse["items"]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [capturingId, setCapturingId] = useState("");
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
    setRadius(
      typeof venue.radius_meters === "number" ? String(venue.radius_meters) : "",
    );
    setDepartmentId(venue.department_id ?? "");
  }

  function resetForm() {
    setSelectedId("");
    setName("");
    setRadius("");
    setDepartmentId("");
  }

  async function saveVenue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    // A venue is a named room. Coordinates are never typed in here: they are
    // captured in the room, by the lecturer who starts a class or by an
    // administrator standing in it.
    const trimmedRadius = radius.trim();
    const details = {
      name: name.trim(),
      ...(trimmedRadius ? { radius_meters: Number(trimmedRadius) } : {}),
      ...(departmentId.trim() ? { department_id: departmentId.trim() } : {}),
    };
    try {
      if (selectedId) {
        const payload: UpdateVenueRequest = details;
        await apiRequest<UpdateVenueResponse>(
          `/venues/${encodeURIComponent(selectedId)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setMessage("Venue updated.");
      } else {
        const payload: CreateVenueRequest = details;
        await apiRequest<CreateVenueResponse>("/venues", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Venue created.");
      }
      resetForm();
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(formatApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function captureLocation(venue: VenueListResponse["items"][number]) {
    setCapturingId(venue.id);
    setError("");
    setMessage("");
    try {
      const fix = await tryGetCurrentPosition();
      if (!fix) {
        setError(
          "This device could not provide a position, so nothing was changed.",
        );
        return;
      }
      const payload: CaptureVenueLocationRequest = {
        latitude: fix.lat,
        longitude: fix.lng,
        accuracy_meters: fix.accuracy,
      };
      const stored = await apiRequest<CaptureVenueLocationResponse>(
        `/venues/${encodeURIComponent(venue.id)}/location`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setMessage(`${stored.name} is now centred on this device's position.`);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const presentation = presentApiError(caught.code, caught.message);
        setError(`${presentation.message} ${presentation.action}`);
      } else setError(formatApiError(caught));
    } finally {
      setCapturingId("");
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
                  {typeof venue.latitude === "number" &&
                  typeof venue.longitude === "number"
                    ? `${venue.latitude.toFixed(5)}, ${venue.longitude.toFixed(5)}${
                        typeof venue.radius_meters === "number"
                          ? ` · ${venue.radius_meters} m`
                          : ""
                      }`
                    : "Location not set yet — the next class here will set it"}
                </span>
                <span>{venue.active ? "Active" : "Inactive"}</span>
              </div>
              <div className="button-row">
                <button
                  className="text-button"
                  disabled={capturingId === venue.id}
                  onClick={() => void captureLocation(venue)}
                >
                  {capturingId === venue.id
                    ? "Reading position…"
                    : "Recalibrate this room"}
                </button>
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
        <p className="field-note">
          A venue only needs a name. Its position is captured inside the room —
          by “Recalibrate this room”, or by the first class started there with
          location allowed.
        </p>
        <label className="field-label">
          Department ID (optional)
          <input
            className="field-control"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          />
        </label>
        <details className="advanced-disclosure">
          <summary>Advanced</summary>
          <label className="field-label">
            Check-in radius in metres (optional)
            <input
              className="field-control"
              type="number"
              min={1}
              max={2000}
              step={1}
              placeholder="Defaults to 75 m once a position is captured"
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
            />
          </label>
        </details>
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
              onClick={resetForm}
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
    if (!userId.trim()) {
      setError("Select a user to assign a role to.");
      return;
    }
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
        <UserSearchSelect
          label="User"
          value={userId}
          onChange={setUserId}
          hint="Search by name or email for the person to grant an administrator role."
        />
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
  const [deleteTarget, setDeleteTarget] = useState<CatalogueItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [catalogueCourses, setCatalogueCourses] = useState<CatalogueItem[]>([]);
  const [catalogueSemesters, setCatalogueSemesters] = useState<CatalogueItem[]>(
    [],
  );
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueReloadKey, setCatalogueReloadKey] = useState(0);
  const [offeringCourseId, setOfferingCourseId] = useState(NEW_COURSE_OPTION);
  const [courseLecturerId, setCourseLecturerId] = useState("");
  const [offeringSemesterId, setOfferingSemesterId] = useState("");
  const [offeringLevel, setOfferingLevel] = useState(100);
  const [registrationMode, setRegistrationMode] =
    useState<CreateOfferingRequest["registration_mode"]>("open");
  const [rosterPolicy, setRosterPolicy] =
    useState<CreateOfferingRequest["roster_policy"]>("open");
  const [minimumAttendance, setMinimumAttendance] = useState(75);
  const [lateCountsAsAttended, setLateCountsAsAttended] = useState(false);
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
  const [offeringMessage, setOfferingMessage] = useState("");
  const [deleteOfferingTarget, setDeleteOfferingTarget] = useState<
    SearchOfferingsResponse["items"][number] | null
  >(null);
  const [deleteOfferingPending, setDeleteOfferingPending] = useState(false);
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
    let active = true;
    setCatalogueLoading(true);
    setCatalogueError("");
    void Promise.all([
      loadCatalogueItems("/courses"),
      loadCatalogueItems("/semesters"),
    ])
      .then(([courses, semesters]) => {
        if (!active) return;
        setCatalogueCourses(courses);
        setCatalogueSemesters(semesters);
        setOfferingCourseId((current) =>
          current === NEW_COURSE_OPTION ||
          courses.some(({ id }) => id === current)
            ? current
            : NEW_COURSE_OPTION,
        );
        setOfferingSemesterId((current) =>
          semesters.some(({ id }) => id === current)
            ? current
            : (semesters[0]?.id ?? ""),
        );
      })
      .catch((caught: unknown) => {
        if (active) setCatalogueError(formatApiError(caught));
      })
      .finally(() => {
        if (active) setCatalogueLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogueReloadKey]);

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
    let courseId = offeringCourseId;
    let resolvedCourseCode = "";
    const creatingNewCourse = courseId === NEW_COURSE_OPTION;
    let courseCreated = false;
    let offeringCreated = false;
    let lecturerAlreadyAssigned = false;
    try {
      if (creatingNewCourse) {
        const coursePayload: CreateCourseRequest = {
          department_id: departmentId,
          code: courseCode.trim(),
          title: courseTitle.trim(),
          ...(courseKind ? { kind: courseKind } : {}),
          ...(courseDescription.trim()
            ? { description: courseDescription.trim() }
            : {}),
          ...(courseCredits !== "" ? { credits: Number(courseCredits) } : {}),
        };
        const createdCourse = await apiRequest<CreateCourseResponse>(
          "/courses",
          {
            method: "POST",
            body: JSON.stringify(coursePayload),
          },
        );
        courseId = createdCourse.id;
        courseCreated = true;
        resolvedCourseCode = coursePayload.code;
        setOfferingCourseId(courseId);
        setCatalogueReloadKey((key) => key + 1);
      } else {
        const selectedCourse = catalogueCourses.find(
          ({ id }) => id === courseId,
        );
        resolvedCourseCode = displayValue(selectedCourse, ["code"]) ?? "";
      }

      const offeringPayload: CreateOfferingRequest = {
        course_id: courseId,
        semester_id: offeringSemesterId,
        level: offeringLevel,
        registration_mode: registrationMode,
        roster_policy: rosterPolicy,
        min_attendance_pct: minimumAttendance,
        late_counts_as_attended: lateCountsAsAttended,
      };
      const result = await apiRequest<CreateOfferingResponse>("/offerings", {
        method: "POST",
        body: JSON.stringify(offeringPayload),
      });
      if ("teaching_request_id" in result) {
        setCourseMessage(
          `${resolvedCourseCode ? `${resolvedCourseCode}: ` : ""}the teaching request is awaiting approval.${courseLecturerId.trim() ? " Assign the lecturer after approval using Manage lecturers." : ""}`,
        );
        return;
      }
      offeringCreated = true;

      const lecturerId = courseLecturerId.trim();
      if (lecturerId) {
        const existingAssignments = await apiRequest<OfferingLecturersResponse>(
          `/offerings/${encodeURIComponent(result.id)}/lecturers`,
        );
        lecturerAlreadyAssigned = existingAssignments.some(
          ({ id }) => id === lecturerId,
        );
        if (!lecturerAlreadyAssigned) {
          const assignment: SetOfferingLecturersRequest = {
            lecturer_ids: [
              ...existingAssignments.map(({ id }) => id),
              lecturerId,
            ],
          };
          const updated = await apiRequest<SetOfferingLecturersResponse>(
            `/offerings/${encodeURIComponent(result.id)}/lecturers`,
            {
              method: "PUT",
              body: JSON.stringify(assignment),
            },
          );
          if (!updated.lecturer_ids.includes(lecturerId)) {
            throw new Error("The server did not record the lecturer assignment.");
          }
        }
      }

      setReloadKey((key) => key + 1);
      setCatalogueReloadKey((key) => key + 1);
      if (resolvedCourseCode) setQuery(resolvedCourseCode);

      const courseLabel = resolvedCourseCode || "Course";
      const semesterLabel =
        displayValue(
          catalogueSemesters.find(({ id }) => id === offeringSemesterId),
          ["name", "title", "code"],
        ) ?? "the selected semester";
      const lecturerStatus = courseLecturerId.trim()
        ? lecturerAlreadyAssigned
          ? " The lecturer was already assigned."
          : " The lecturer was assigned."
        : "";
      setCourseMessage(
        `${courseLabel} is now available for ${semesterLabel}.${lecturerStatus}`,
      );
      setCourseLecturerId("");
      setCourseCode("");
      setCourseTitle("");
      setCourseDescription("");
      setCourseCredits("");
    } catch (caught) {
      if (offeringCreated) {
        setCourseError(
          `${resolvedCourseCode ? `${resolvedCourseCode} ` : "The course "}is available for the selected semester, but the lecturer could not be assigned: ${formatApiError(caught)}`,
        );
      } else if (courseCreated) {
        setCourseError(
          `${resolvedCourseCode} was created, but could not be made available for the selected semester: ${formatApiError(caught)}`,
        );
      } else {
        setCourseError(formatApiError(caught));
      }
    } finally {
      setCoursePending(false);
    }
  }

  async function deleteCourse() {
    if (!deleteTarget) return;
    const label =
      [
        displayValue(deleteTarget, ["code"]),
        displayValue(deleteTarget, ["title", "name"]),
      ]
        .filter(Boolean)
        .join(" · ") || "Course";
    setDeletePending(true);
    setCourseError("");
    setCourseMessage("");
    try {
      await apiRequest<void>(
        `/courses/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      setCourseMessage(`${label} was deleted.`);
      setOfferingCourseId(NEW_COURSE_OPTION);
      setDeleteTarget(null);
      setCatalogueReloadKey((key) => key + 1);
    } catch (caught) {
      setCourseError(
        caught instanceof ApiError
          ? presentApiError(caught.code, caught.message).message
          : formatApiError(caught),
      );
      setDeleteTarget(null);
    } finally {
      setDeletePending(false);
    }
  }

  async function deleteOffering() {
    if (!deleteOfferingTarget) return;
    const label = `${deleteOfferingTarget.course_code} · ${deleteOfferingTarget.course_title}`;
    const removedId = deleteOfferingTarget.offering_id;
    setDeleteOfferingPending(true);
    setError("");
    setOfferingMessage("");
    try {
      await apiRequest<void>(
        `/offerings/${encodeURIComponent(removedId)}`,
        { method: "DELETE" },
      );
      setOfferingMessage(`${label} (offering) was deleted.`);
      setDeleteOfferingTarget(null);
      if (managedOffering?.offering_id === removedId) setManagedOffering(null);
      setReloadKey((key) => key + 1);
      // The course may now be free of offerings and therefore deletable.
      setCatalogueReloadKey((key) => key + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? presentApiError(caught.code, caught.message).message
          : formatApiError(caught),
      );
      setDeleteOfferingTarget(null);
    } finally {
      setDeleteOfferingPending(false);
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
    if (!id) {
      setLecturerError("Select a lecturer to assign.");
      return;
    }
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
            ) ?? { id: lecturerId, display_name: lecturerId, email: "" },
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
        subtitle={`Courses available in ${user.name}'s administrator scope, with their assigned lecturers.`}
      />
      <section className="panel">
        <h2>Create a course</h2>
        <p className="admin-offering-note">
          Create a course and make it available for a semester in one step, or
          choose an existing course to add it to another semester. Semester,
          level, and registration details configure how the course is offered;
          the lecturer can then start class sessions for it.
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
        {catalogueError && (
          <div className="api-state-error" role="alert">
            <p>{catalogueError}</p>
            <button
              className="text-button"
              onClick={() => setCatalogueReloadKey((key) => key + 1)}
              type="button"
            >
              Retry course and semester lists
            </button>
          </div>
        )}
        <form className="admin-course-form" onSubmit={createCourse}>
          <label className="field-label">
            Course
            <select
              className="field-control"
              required
              value={offeringCourseId}
              onChange={(event) => setOfferingCourseId(event.target.value)}
              disabled={catalogueLoading || coursePending}
            >
              <option value={NEW_COURSE_OPTION}>Create a new course…</option>
              {catalogueCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {[
                    displayValue(course, ["code"]),
                    displayValue(course, ["title", "name"]),
                  ]
                    .filter(Boolean)
                    .join(" · ") || course.id}
                </option>
              ))}
            </select>
          </label>
          {offeringCourseId !== NEW_COURSE_OPTION && (
            <div className="course-delete-row">
              <small>
                Deleting a course removes it from the catalogue. A course that
                still has offerings must have them removed first.
              </small>
              <button
                type="button"
                className="text-button text-button-danger"
                disabled={coursePending || deletePending || catalogueLoading}
                onClick={() => {
                  const course = catalogueCourses.find(
                    (item) => item.id === offeringCourseId,
                  );
                  if (course) setDeleteTarget(course);
                }}
              >
                Delete course
              </button>
            </div>
          )}
          {offeringCourseId === NEW_COURSE_OPTION && (
            <>
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
                      event.target.value === "general"
                        ? "general"
                        : "departmental",
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
            </>
          )}
          <label className="field-label">
            Semester
            <select
              className="field-control"
              required
              value={offeringSemesterId}
              onChange={(event) => setOfferingSemesterId(event.target.value)}
              disabled={catalogueLoading || catalogueSemesters.length === 0}
            >
              {catalogueSemesters.length === 0 && (
                <option value="">
                  {catalogueLoading
                    ? "Loading semesters…"
                    : "Create a semester in Academic calendar first"}
                </option>
              )}
              {catalogueSemesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {displayValue(semester, ["name", "title", "code"]) ??
                    semester.id}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Level
            <input
              className="field-control"
              type="number"
              min="1"
              value={offeringLevel}
              onChange={(event) => setOfferingLevel(Number(event.target.value))}
              required
            />
          </label>
          <UserSearchSelect
            label="Lecturer (optional)"
            value={courseLecturerId}
            onChange={setCourseLecturerId}
            role="lecturer"
            hint="Search by name or email to assign a lecturer when the offering is created."
          />
          <div className="field-label registration-field">
            Registration
            <div
              className="segmented"
              role="radiogroup"
              aria-label="Registration mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={registrationMode === "open"}
                className={`segmented-option${registrationMode === "open" ? " is-active" : ""}`}
                onClick={() => setRegistrationMode("open")}
              >
                Self-register
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={registrationMode === "approval"}
                className={`segmented-option${registrationMode === "approval" ? " is-active" : ""}`}
                onClick={() => setRegistrationMode("approval")}
              >
                Needs approval
              </button>
            </div>
            <small>
              {registrationMode === "open"
                ? "Students register themselves and are approved immediately."
                : registrationMode === "approval"
                  ? "Students register and a lecturer or admin approves each request."
                  : registrationMode === "auto"
                    ? "Matching department-and-level students are enrolled automatically."
                    : "No new registrations are accepted."}
            </small>
            <details
              className="advanced-modes"
              open={registrationMode === "auto" || registrationMode === "closed"}
            >
              <summary>Advanced registration modes</summary>
              <div
                className="segmented"
                role="radiogroup"
                aria-label="Advanced registration mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={registrationMode === "auto"}
                  className={`segmented-option${registrationMode === "auto" ? " is-active" : ""}`}
                  onClick={() => setRegistrationMode("auto")}
                >
                  Automatic enrolment
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={registrationMode === "closed"}
                  className={`segmented-option${registrationMode === "closed" ? " is-active" : ""}`}
                  onClick={() => setRegistrationMode("closed")}
                >
                  Closed
                </button>
              </div>
            </details>
          </div>
          <label className="field-label">
            Roster policy
            <select
              className="field-control"
              value={rosterPolicy}
              onChange={(event) =>
                setRosterPolicy(
                  event.target.value as CreateOfferingRequest["roster_policy"],
                )
              }
            >
              <option value="open">Open</option>
              <option value="registered_only">Registered students only</option>
            </select>
          </label>
          <label className="field-label">
            Minimum attendance (%)
            <input
              className="field-control"
              type="number"
              min="0"
              max="100"
              step="1"
              value={minimumAttendance}
              onChange={(event) =>
                setMinimumAttendance(Number(event.target.value))
              }
              required
            />
          </label>
          <label className="session-option">
            <input
              type="checkbox"
              checked={lateCountsAsAttended}
              onChange={(event) =>
                setLateCountsAsAttended(event.target.checked)
              }
            />
            Late attendance counts as attended
          </label>
          <button
            className="button primary-button"
            disabled={
              coursePending ||
              catalogueLoading ||
              catalogueSemesters.length === 0 ||
              (offeringCourseId === NEW_COURSE_OPTION &&
                (departmentsLoading || departmentOptions.length === 0))
            }
            type="submit"
          >
            {coursePending
              ? "Saving course…"
              : offeringCourseId === NEW_COURSE_OPTION
                ? "Create course"
                : "Add course to semester"}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Courses</h2>
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
          Lecturer names are shown for each course in its semester. This is not
          a directory of staff who have no courses assigned.
        </p>
        {offeringMessage && (
          <div className="form-info" role="status">
            {offeringMessage}
          </div>
        )}
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
                  <div className="button-row">
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
                    <button
                      className="text-button text-button-danger"
                      type="button"
                      disabled={deleteOfferingPending}
                      onClick={() => setDeleteOfferingTarget(offering)}
                      aria-label={`Delete offering ${offering.course_code}`}
                    >
                      Delete offering
                    </button>
                  </div>
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
                        Load the current assignments before adding a lecturer so
                        existing assignments are preserved.
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
                          onSubmit={(event) => void addOfferingLecturer(event)}
                        >
                          <UserSearchSelect
                            label="Lecturer"
                            value={lecturerAccountId}
                            onChange={setLecturerAccountId}
                            role="lecturer"
                          />
                          <button
                            className="button secondary-button"
                            disabled={lecturerPending || !lecturerAccountId}
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
      {deleteTarget && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-course-title"
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => setDeleteTarget(null)}
            >
              ×
            </button>
            <h2 id="delete-course-title">
              Delete{" "}
              {[
                displayValue(deleteTarget, ["code"]),
                displayValue(deleteTarget, ["title", "name"]),
              ]
                .filter(Boolean)
                .join(" · ") || "this course"}
              ?
            </h2>
            <p>
              This removes the course from the catalogue. It can't be undone. A
              course that still has offerings can't be deleted — remove its
              offerings first.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary-button"
                type="button"
                disabled={deletePending}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={deletePending}
                onClick={() => void deleteCourse()}
              >
                {deletePending ? "Deleting…" : "Delete course"}
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteOfferingTarget && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-offering-title"
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => setDeleteOfferingTarget(null)}
            >
              ×
            </button>
            <h2 id="delete-offering-title">
              Delete the {deleteOfferingTarget.course_code}
              {deleteOfferingTarget.semester
                ? ` · ${deleteOfferingTarget.semester}`
                : ""}{" "}
              offering?
            </h2>
            <p>
              This removes the offering and its lecturer assignments. Attendance
              already recorded is kept. This can't be undone.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary-button"
                type="button"
                disabled={deleteOfferingPending}
                onClick={() => setDeleteOfferingTarget(null)}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={deleteOfferingPending}
                onClick={() => void deleteOffering()}
              >
                {deleteOfferingPending ? "Deleting…" : "Delete offering"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
