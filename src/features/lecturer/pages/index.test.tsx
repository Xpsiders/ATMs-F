import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type {
  CaptureVenueLocationRequest,
  LiveSessionResponse,
  CurrentUser,
  OfferingsResponse,
  SessionCodeResponse,
  SessionLocationRequest,
  SessionLocationResult,
  SessionReportResponse,
  StartSessionRequest,
  StartSessionResponse,
  VenueListResponse,
} from "@/api/contracts";
import { server } from "@/test/setup";
import { resetDemoData } from "@/mocks/store";
import { LiveSession, Report, StartSession } from "./index";
import {
  rememberLiveSession,
  rememberSessionReport,
} from "../liveSessionStorage";

const position = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: vi.fn(),
  tryGetCurrentPosition: position,
  GeoError: class GeoError extends Error {},
}));

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const sessionId = "30000000-0000-4000-8000-000000000001";
const lecturer = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Dr. Test Lecturer",
  email: "lecturer@example.test",
  status: "active",
  must_change_password: false,
  roles: [
    {
      role: "lecturer",
      scope_type: "department",
      scope_id: "10000000-0000-4000-8000-000000000001",
      department_id: "10000000-0000-4000-8000-000000000001",
    },
  ],
} satisfies CurrentUser;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_USE_MOCKS", "false");
  resetDemoData();
  position.mockReset();
  position.mockResolvedValue({ lat: 6.5244, lng: 3.3792, accuracy: 12.5 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderLecturerPage(page: React.ReactNode, path: string) {
  window.history.pushState({}, "", path);
  return render(<BrowserRouter>{page}</BrowserRouter>);
}

describe("lecturer session data", () => {
  it("renders live attendance and session labels from backend responses", async () => {
    const offerings: OfferingsResponse = {
      items: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          course_code: "API 401",
          course_title: "Backend Data Systems",
          session_open: true,
          next_timetable_slot: null,
        },
      ],
      limit: 1,
      offset: 0,
      has_more: false,
    };
    const venues: VenueListResponse = {
      items: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          name: "API Hall",
          latitude: 6.5,
          longitude: 3.4,
          radius_meters: 40,
          active: true,
        },
      ],
      limit: 1,
      offset: 0,
      total: 1,
    };
    const codeResponse: SessionCodeResponse = {
      session: {
        id: sessionId,
        offering_id: offerings.items[0]!.id,
        venue_id: venues.items[0]!.id,
        started_at: "2026-10-23T07:00:00Z",
        latitude: 6.5,
        longitude: 3.4,
        radius_meters: 40,
        rotating_code: true,
        late_after_min: 10,
      },
      code: "827451",
      seconds_remaining: 20,
    };
    const liveResponse: LiveSessionResponse = {
      session_id: sessionId,
      counts: { web_checkins: 17, scans: 8, registered: 24 },
      items: [
        {
          student_id: "60000000-0000-4000-8000-000000000001",
          matric_no: "API-1001",
          display_name: "Backend Student",
          status: "present",
          classification: "verified",
          on_roster: true,
          has_web_checkin: true,
          has_scan: true,
        },
      ],
      limit: 200,
      offset: 0,
      has_more: false,
    };
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/code`, () =>
        HttpResponse.json(codeResponse),
      ),
      http.get(`${apiBaseUrl}/sessions/${sessionId}/live`, () =>
        HttpResponse.json(liveResponse),
      ),
      http.get(`${apiBaseUrl}/me/offerings`, () => HttpResponse.json(offerings)),
      http.get(`${apiBaseUrl}/venues`, () => HttpResponse.json(venues)),
    );
    rememberLiveSession(lecturer.id, {
      sessionId,
      offeringId: offerings.items[0]!.id,
    });
    renderLecturerPage(<LiveSession user={lecturer} />, "/lecturer/live");

    expect(
      await screen.findByRole("heading", { name: "API 401 · Backend Data Systems" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Backend Student")).toBeInTheDocument();
    expect(screen.getByText("API Hall")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.queryByText("Amara Okafor")).not.toBeInTheDocument();
  });

  it("renders report rows and calculated summary from the backend", async () => {
    const report: SessionReportResponse = {
      session_id: sessionId,
      scanner_coverage: { state: "full", offline_intervals: [] },
      items: [
        {
          student_record_id: "60000000-0000-4000-8000-000000000001",
          matric_no: "API-1001",
          display_name: "Backend Student",
          department_id: "70000000-0000-4000-8000-000000000001",
          level: 400,
          on_roster: true,
          classification: "verified",
          status: "present",
        },
      ],
      limit: 200,
      offset: 0,
      has_more: false,
    };
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/report`, () =>
        HttpResponse.json(report),
      ),
    );
    renderLecturerPage(<Report user={lecturer} />, `/lecturer/report?sessionId=${sessionId}`);

    expect(await screen.findAllByText("Backend Student")).toHaveLength(2);
    expect(screen.getByText("API-1001")).toBeInTheDocument();
    expect(document.querySelector(".report-summary b")).toHaveTextContent("1");
    expect(screen.queryByText("Amara Okafor")).not.toBeInTheDocument();
  });

  it("keeps proxy classification, attendance status, and backend reason separate", async () => {
    const report: SessionReportResponse = {
      session_id: sessionId,
      scanner_coverage: { state: "full", offline_intervals: [] },
      items: [
        {
          student_record_id: "60000000-0000-4000-8000-000000000001",
          matric_no: "API-1001",
          display_name: "Proxy Review Student",
          department_id: "70000000-0000-4000-8000-000000000001",
          level: 400,
          on_roster: true,
          classification: "proxy",
          status: "present",
          reason: "location_unverified",
        },
        {
          student_record_id: "60000000-0000-4000-8000-000000000002",
          matric_no: "API-1002",
          display_name: "Fingerprint Confirmed Student",
          department_id: "70000000-0000-4000-8000-000000000001",
          level: 400,
          on_roster: true,
          classification: "present_no_web_log",
          status: "present",
        },
      ],
      limit: 200,
      offset: 0,
      has_more: false,
    };
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/report`, () =>
        HttpResponse.json(report),
      ),
    );
    renderLecturerPage(<Report user={lecturer} />, `/lecturer/report?sessionId=${sessionId}`);

    const proxyRow = await screen.findByRole("row", {
      name: /Proxy Review Student/,
    });
    expect(proxyRow).toHaveTextContent("Present");
    expect(proxyRow).toHaveTextContent("Needs review (proxy)");
    expect(proxyRow).toHaveTextContent("Location could not be matched");

    const fingerprintRow = screen.getByRole("row", {
      name: /Fingerprint Confirmed Student/,
    });
    expect(fingerprintRow).toHaveTextContent("Present");
    expect(fingerprintRow).toHaveTextContent("Scan only");
  });

  it("opens a completed report from saved session history without a URL ID", async () => {
    const report: SessionReportResponse = {
      session_id: sessionId,
      scanner_coverage: { state: "full", offline_intervals: [] },
      items: [
        {
          student_record_id: "60000000-0000-4000-8000-000000000001",
          matric_no: "API-1001",
          display_name: "Completed Session Student",
          department_id: "70000000-0000-4000-8000-000000000001",
          level: 400,
          on_roster: true,
          classification: "verified",
          status: "present",
        },
      ],
      limit: 200,
      offset: 0,
      has_more: false,
    };
    const session: SessionCodeResponse["session"] = {
      id: sessionId,
      offering_id: "40000000-0000-4000-8000-000000000001",
      venue_id: "50000000-0000-4000-8000-000000000001",
      started_at: "2026-10-23T07:00:00Z",
      latitude: 6.5,
      longitude: 3.4,
      radius_meters: 40,
      rotating_code: true,
      late_after_min: 10,
    };
    rememberSessionReport(
      lecturer.id,
      session,
      "API 401 · Backend Data Systems",
    );
    const requestedUrls: string[] = [];
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/report`, ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json(report);
      }),
    );
    renderLecturerPage(<Report user={lecturer} />, "/lecturer/report");

    expect(await screen.findAllByText("Completed Session Student")).toHaveLength(
      2,
    );
    expect(requestedUrls).toContain(
      `${apiBaseUrl}/sessions/${sessionId}/report?limit=200&offset=0`,
    );
  });

  it("downloads the report PDF from the session endpoint", async () => {
    const user = userEvent.setup();
    const report: SessionReportResponse = {
      session_id: sessionId,
      scanner_coverage: { state: "full", offline_intervals: [] },
      items: [],
      limit: 200,
      offset: 0,
      has_more: false,
    };
    let acceptHeader = "";
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/report`, ({ request }) => {
        if (new URL(request.url).searchParams.get("format") === "pdf") {
          acceptHeader = request.headers.get("accept") ?? "";
          return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
            headers: { "Content-Type": "application/pdf" },
          });
        }
        return HttpResponse.json(report);
      }),
    );
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:session-report"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      renderLecturerPage(
        <Report user={lecturer} />,
        `/lecturer/report?sessionId=${sessionId}`,
      );
      await user.click(await screen.findByRole("button", { name: "Export PDF" }));
      await vi.waitFor(() => expect(acceptHeader).toBe("application/pdf"));
      expect(click).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
      if (originalCreateObjectURL)
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: originalCreateObjectURL,
        });
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (originalRevokeObjectURL)
        Object.defineProperty(URL, "revokeObjectURL", {
          configurable: true,
          value: originalRevokeObjectURL,
        });
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
  it("starts a class with location refused and sends no location fields", async () => {
    const user = userEvent.setup();
    position.mockResolvedValue(null);
    const offeringId = "40000000-0000-4000-8000-000000000009";
    const venueId = "50000000-0000-4000-8000-000000000009";
    let startBody: StartSessionRequest | null = null;
    server.use(
      http.get(`${apiBaseUrl}/me/offerings`, () =>
        HttpResponse.json({
          items: [
            {
              id: offeringId,
              course_code: "GEO 101",
              course_title: "Rooms Without Coordinates",
              session_open: false,
              next_timetable_slot: null,
            },
          ],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies OfferingsResponse),
      ),
      http.get(`${apiBaseUrl}/venues`, () =>
        HttpResponse.json({
          items: [
            {
              id: venueId,
              name: "Studio 3",
              latitude: null,
              longitude: null,
              radius_meters: null,
              active: true,
            },
          ],
          limit: 1,
          offset: 0,
          total: 1,
        } satisfies VenueListResponse),
      ),
      http.post(`${apiBaseUrl}/sessions`, async ({ request }) => {
        startBody = (await request.json()) as StartSessionRequest;
        return HttpResponse.json(
          {
            session: {
              id: sessionId,
              offering_id: offeringId,
              venue_id: venueId,
              started_at: "2026-10-28T08:00:00Z",
              latitude: null,
              longitude: null,
              radius_meters: null,
              rotating_code: true,
              late_after_min: 10,
            },
            code: "418203",
            seconds_remaining: 42,
            location_source: "none",
          } satisfies StartSessionResponse,
          { status: 201 },
        );
      }),
    );
    renderLecturerPage(<StartSession user={lecturer} />, "/lecturer/start");

    await user.click(
      await screen.findByRole("button", { name: "Start session" }),
    );
    await vi.waitFor(() => expect(startBody).not.toBeNull());
    expect(startBody).toEqual({
      offering_id: offeringId,
      venue_id: venueId,
      rotating_code: true,
      late_after_min: 10,
    } satisfies StartSessionRequest);
    expect(window.location.pathname).toBe("/lecturer/live");
  });

  it("reports a session without a geofence instead of zero coordinates", async () => {
    // Location stayed refused, so nothing re-centres the session either.
    position.mockResolvedValue(null);
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/code`, () =>
        HttpResponse.json({
          session: {
            id: sessionId,
            offering_id: "40000000-0000-4000-8000-000000000009",
            venue_id: "50000000-0000-4000-8000-000000000009",
            started_at: "2026-10-28T08:00:00Z",
            latitude: null,
            longitude: null,
            radius_meters: null,
            rotating_code: true,
            late_after_min: 10,
          },
          code: "418203",
          seconds_remaining: 42,
        } satisfies SessionCodeResponse),
      ),
      http.get(`${apiBaseUrl}/sessions/${sessionId}/live`, () =>
        HttpResponse.json({
          session_id: sessionId,
          counts: { web_checkins: 1, scans: 0, registered: 1 },
          items: [],
          limit: 200,
          offset: 0,
          has_more: false,
        } satisfies LiveSessionResponse),
      ),
    );
    renderLecturerPage(
      <LiveSession user={lecturer} />,
      `/lecturer/live?sessionId=${sessionId}`,
    );

    expect(await screen.findByText("418 203")).toBeInTheDocument();
    expect(
      await screen.findByText(/No check-in area for this class/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("NaN");
    expect(document.body.textContent).not.toContain("0, 0");
  });

  it("posts the lecturer's fix unmodified and keeps the area put on drift", async () => {
    let locationBody: SessionLocationRequest | null = null;
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/code`, () =>
        HttpResponse.json({
          session: {
            id: sessionId,
            offering_id: "40000000-0000-4000-8000-000000000009",
            venue_id: "50000000-0000-4000-8000-000000000009",
            started_at: "2026-10-28T08:00:00Z",
            latitude: 6.5244,
            longitude: 3.3792,
            radius_meters: 75,
            rotating_code: true,
            late_after_min: 10,
          },
          code: "418203",
          seconds_remaining: 42,
        } satisfies SessionCodeResponse),
      ),
      http.get(`${apiBaseUrl}/sessions/${sessionId}/live`, () =>
        HttpResponse.json({
          session_id: sessionId,
          counts: { web_checkins: 1, scans: 0, registered: 1 },
          items: [],
          limit: 200,
          offset: 0,
          has_more: false,
        } satisfies LiveSessionResponse),
      ),
      http.post(
        `${apiBaseUrl}/sessions/${sessionId}/location`,
        async ({ request }) => {
          locationBody = (await request.json()) as SessionLocationRequest;
          return HttpResponse.json({
            session_id: sessionId,
            outcome: "rejected_distance",
            latitude: 6.5244,
            longitude: 3.3792,
            radius_meters: 75,
            moved_meters: 310,
          } satisfies SessionLocationResult);
        },
      ),
    );
    renderLecturerPage(
      <LiveSession user={lecturer} />,
      `/lecturer/live?sessionId=${sessionId}`,
    );

    await vi.waitFor(() => expect(locationBody).not.toBeNull());
    expect(locationBody).toEqual({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy_meters: 12.5,
    } satisfies SessionLocationRequest);
    expect(
      await screen.findByText(/stayed with the students in the room/),
    ).toBeInTheDocument();
    expect(document.body.textContent).toContain("6.52440, 3.37920");
  });

  it("recalibrates the room from the lecturer's own device", async () => {
    const user = userEvent.setup();
    const venueId = "50000000-0000-4000-8000-000000000009";
    let captureBody: CaptureVenueLocationRequest | null = null;
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/code`, () =>
        HttpResponse.json({
          session: {
            id: sessionId,
            offering_id: "40000000-0000-4000-8000-000000000009",
            venue_id: venueId,
            started_at: "2026-10-28T08:00:00Z",
            latitude: 6.5244,
            longitude: 3.3792,
            radius_meters: 75,
            rotating_code: true,
            late_after_min: 10,
          },
          code: "418203",
          seconds_remaining: 42,
        } satisfies SessionCodeResponse),
      ),
      http.get(`${apiBaseUrl}/sessions/${sessionId}/live`, () =>
        HttpResponse.json({
          session_id: sessionId,
          counts: { web_checkins: 0, scans: 0, registered: 0 },
          items: [],
          limit: 200,
          offset: 0,
          has_more: false,
        } satisfies LiveSessionResponse),
      ),
      http.post(`${apiBaseUrl}/sessions/${sessionId}/location`, () =>
        HttpResponse.json({
          session_id: sessionId,
          outcome: "unchanged",
          latitude: 6.5244,
          longitude: 3.3792,
          radius_meters: 75,
          moved_meters: 2,
        } satisfies SessionLocationResult),
      ),
      http.post(`${apiBaseUrl}/venues/${venueId}/location`, async ({ request }) => {
        captureBody = (await request.json()) as CaptureVenueLocationRequest;
        return HttpResponse.json({
          id: venueId,
          name: "Studio 3",
          latitude: 6.5244,
          longitude: 3.3792,
          radius_meters: 75,
          active: true,
        });
      }),
    );
    renderLecturerPage(
      <LiveSession user={lecturer} />,
      `/lecturer/live?sessionId=${sessionId}`,
    );

    await user.click(
      await screen.findByRole("button", { name: "Recalibrate this room" }),
    );
    await vi.waitFor(() => expect(captureBody).not.toBeNull());
    expect(captureBody).toEqual({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy_meters: 12.5,
    } satisfies CaptureVenueLocationRequest);
    expect(
      await screen.findByText(/Studio 3 is now centred/),
    ).toBeInTheDocument();
  });

  it("shows every unverified reason as one severity of needs confirmation", async () => {
    const reasons = [
      ["scanner_unavailable", "Scanner marked unavailable"],
      ["scanner_offline", "No scanner heartbeat at check-in"],
      ["location_unverified", "Location could not be matched"],
      ["no_fingerprint", "No fingerprint scan"],
    ] as const;
    server.use(
      http.get(`${apiBaseUrl}/sessions/${sessionId}/report`, () =>
        HttpResponse.json({
          session_id: sessionId,
          scanner_coverage: { state: "partial", offline_intervals: [] },
          items: reasons.map(([reason], index) => ({
            student_record_id: `60000000-0000-4000-8000-00000000000${index + 1}`,
            matric_no: `API-100${index + 1}`,
            display_name: `Student ${reason}`,
            department_id: "70000000-0000-4000-8000-000000000001",
            level: 400,
            on_roster: true,
            classification: "web_only_unverified" as const,
            status: "present",
            reason,
          })),
          limit: 200,
          offset: 0,
          has_more: false,
        } satisfies SessionReportResponse),
      ),
    );
    renderLecturerPage(
      <Report user={lecturer} />,
      `/lecturer/report?sessionId=${sessionId}`,
    );

    expect(
      await screen.findByText(/4 records need confirmation/),
    ).toBeInTheDocument();
    // One classification, one severity: the server cannot tell these apart.
    const chips = document.querySelectorAll(
      ".report-table .status-chip.web_only_unverified",
    );
    expect(chips).toHaveLength(reasons.length);
    for (const [, label] of reasons)
      expect(await screen.findAllByText(label)).not.toHaveLength(0);
  });
});
