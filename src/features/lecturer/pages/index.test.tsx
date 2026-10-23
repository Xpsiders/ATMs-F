import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type {
  LiveSessionResponse,
  OfferingsResponse,
  SessionCodeResponse,
  SessionReportResponse,
  VenueListResponse,
} from "@/api/contracts";
import { server } from "@/test/setup";
import { resetDemoData } from "@/mocks/store";
import { LiveSession, Report } from "./index";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const sessionId = "30000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.stubEnv("VITE_USE_MOCKS", "false");
  resetDemoData();
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
    renderLecturerPage(
      <LiveSession />,
      `/lecturer/live?sessionId=${sessionId}`,
    );

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
    renderLecturerPage(<Report />, `/lecturer/report?sessionId=${sessionId}`);

    expect(await screen.findAllByText("Backend Student")).toHaveLength(2);
    expect(screen.getByText("API-1001")).toBeInTheDocument();
    expect(document.querySelector(".report-summary b")).toHaveTextContent("1");
    expect(screen.queryByText("Amara Okafor")).not.toBeInTheDocument();
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
        <Report />,
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
});
