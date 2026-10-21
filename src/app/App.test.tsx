import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { App } from "./App";
import { server } from "@/test/setup";
import type {
  CurrentUser,
  EndSessionResponse,
  LiveClassesResponse,
  OfferingsResponse,
  SessionCodeResponse,
  StartSessionRequest,
  StartSessionResponse,
  StudentAttendanceResponse,
  StudentCoursesResponse,
  StudentTimetableResponse,
} from "@/api/contracts";
import {
  clearMockSession,
  getMockSession,
  startMockSession,
  type DemoRole,
} from "@/mocks/auth";
import {
  getDemoState,
  resetDemoData,
  updateDemoState,
} from "@/mocks/store";

vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: vi
    .fn()
    .mockResolvedValue({ lat: 6.5, lng: 3.4, accuracy: 20 }),
  GeoError: class GeoError extends Error {},
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_USE_MOCKS", "true");
  clearMockSession();
  resetDemoData();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "wakeLock");
});

function renderApp(
  path = "/",
  withMockSession = true,
  role: DemoRole = path.startsWith("/lecturer")
    ? "lecturer"
    : path === "/admin/institution"
      ? "institution-admin"
      : path.startsWith("/admin")
        ? "department-admin"
        : "student",
) {
  if (withMockSession && !startMockSession(role))
    throw new Error("Mock mode is required for authenticated screen tests.");
  window.history.pushState({}, "", path);
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
}

function clearAmaraCheckIn() {
  updateDemoState((current) => ({
    ...current,
    attendance: current.attendance.map((record) =>
      record.studentId === "2021-18420"
        ? { ...record, webTime: "—", status: "absent" }
        : record,
    ),
  }));
}

function demoSessionPath(path: string) {
  const session = getDemoState().sessions.find(
    (candidate) => candidate.state === "live",
  );
  if (!session) throw new Error("The demo store has no live session.");
  return `${path}?sessionId=${encodeURIComponent(session.id)}`;
}

describe("Campus Attendance screens", () => {
  it("shows the student overview and attendance warning", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Your day at a glance" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Below the 75% attendance requirement/,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it("shows only API offerings assigned to the lecturer and starts the selected offering", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const assignedOfferings: OfferingsResponse = {
      items: [
        {
          id: "10000000-0000-4000-8000-000000000731",
          course_code: "BIO 731",
          course_title: "API Lecturer's Assigned Course",
        },
      ],
      limit: 1,
      offset: 0,
      has_more: false,
    };
    server.use(
      http.get(`${apiBaseUrl}/me/offerings`, () =>
        HttpResponse.json(assignedOfferings),
      ),
    );
    renderApp("/lecturer", true, "lecturer");

    expect(
      await screen.findByRole("heading", {
        name: "Welcome, Dr. Ngozi Eze",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("BIO 731 · API Lecturer's Assigned Course"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Human Computer Interaction · CSC 342"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("link", {
        name: "Start BIO 731 · API Lecturer's Assigned Course session",
      }),
    );
    const offeringSelect = await screen.findByRole("combobox", {
      name: "Offering",
    });
    await waitFor(() => expect(offeringSelect).toHaveValue(assignedOfferings.items[0]!.id));
    expect(window.location.pathname).toBe("/lecturer/start");
    expect(
      screen.getByRole("link", { name: "CampusCheck home" }),
    ).toHaveAttribute("href", "/lecturer");
  });

  it("renders the home screen from backend live, timetable, and course data", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const campusClockAfter = (minutesFromNow: number) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(Date.now() + minutesFromNow * 60_000));
      const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
      const minute =
        parts.find((part) => part.type === "minute")?.value ?? "00";
      return `${hour}:${minute}:00+01:00`;
    };
    const liveClasses: LiveClassesResponse = {
      items: [
        {
          session_id: "30000000-0000-4000-8000-000000000001",
          offering_id: "10000000-0000-4000-8000-000000000001",
          course_code: "API 401",
          course_title: "Backend Live Course",
          venue_id: "10000000-0000-4000-8000-000000000012",
          venue_name: "Backend Lecture Hall",
          lecturer_name: "Dr. Backend Lecturer",
          started_at: new Date(Date.now() - 15 * 60_000).toISOString(),
          late_after_min: 10,
          rotating_code: true,
          already_checked_in: true,
        },
      ],
    };
    const timetable: StudentTimetableResponse = {
      date: "2026-10-21",
      items: [
        {
          offering_id: "10000000-0000-4000-8000-000000000002",
          course_code: "API 402",
          course_title: "Backend Upcoming Course",
          venue_id: "10000000-0000-4000-8000-000000000013",
          venue_name: "Backend Schedule Hall",
          starts_at: campusClockAfter(45),
          ends_at: campusClockAfter(105),
          live_now: false,
        },
        {
          offering_id: "10000000-0000-4000-8000-000000000003",
          course_code: "API 403",
          course_title: "Backend Already Live Course",
          venue_id: "10000000-0000-4000-8000-000000000014",
          venue_name: "Another Backend Hall",
          starts_at: campusClockAfter(10),
          ends_at: campusClockAfter(70),
          live_now: true,
        },
      ],
    };
    const courses: StudentCoursesResponse = {
      items: [
        {
          offering_id: "10000000-0000-4000-8000-000000000004",
          course_code: "API 404",
          course_title: "Backend Attendance Course",
          lecturer_names: ["Dr. Attendance Lecturer"],
          sessions_held: 10,
          sessions_attended: 4,
          attendance_percentage: 42.6,
          minimum_attendance_percentage: 60,
          below_threshold: true,
        },
      ],
    };
    server.use(
      http.get(`${apiBaseUrl}/me/live-classes`, () =>
        HttpResponse.json(liveClasses),
      ),
      http.get(`${apiBaseUrl}/me/timetable`, () =>
        HttpResponse.json(timetable),
      ),
      http.get(`${apiBaseUrl}/me/courses`, () => HttpResponse.json(courses)),
    );

    renderApp("/");

    await screen.findByRole("heading", { name: "Your day at a glance" });
    await screen.findByText("Backend Live Course");
    const livePanel = screen.getByRole("heading", { name: "Live now" })
      .closest("section");
    expect(livePanel).toHaveTextContent("Backend Live Course");
    expect(livePanel).toHaveTextContent("Backend Lecture Hall");
    expect(livePanel).toHaveTextContent("Checked in");
    expect(
      within(livePanel as HTMLElement).queryByRole("link", {
        name: /Check in/,
      }),
    ).not.toBeInTheDocument();

    const laterPanel = screen.getByRole("heading", { name: "Later today" })
      .closest("section");
    expect(laterPanel).toHaveTextContent("Backend Upcoming Course");
    expect(laterPanel).toHaveTextContent("Backend Schedule Hall");
    expect(laterPanel).not.toHaveTextContent("Backend Already Live Course");

    expect(
      screen.getByText("Classes today").closest(".summary-item"),
    ).toHaveTextContent("2 classes");
    expect(
      screen.getByText("Live classes").closest(".summary-item"),
    ).toHaveTextContent("1");
    expect(screen.getByText("API 404 · Backend Attendance Course")).toBeInTheDocument();
    await screen.findByText("43%");
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(
      screen.getByText(/Below the 60% attendance requirement/),
    ).toBeInTheDocument();
  });

  it("does not call a populated past timetable empty", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const campusClockBefore = (minutesAgo: number) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(Date.now() - minutesAgo * 60_000));
      const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
      const minute =
        parts.find((part) => part.type === "minute")?.value ?? "00";
      return `${hour}:${minute}:00+01:00`;
    };
    const timetable: StudentTimetableResponse = {
      date: "2026-10-21",
      items: [
        {
          offering_id: "10000000-0000-4000-8000-000000000005",
          course_code: "API 405",
          course_title: "Backend Earlier Course",
          venue_id: "10000000-0000-4000-8000-000000000015",
          venue_name: "Backend Past Hall",
          starts_at: campusClockBefore(60),
          ends_at: campusClockBefore(15),
          live_now: false,
        },
      ],
    };
    server.use(
      http.get(`${apiBaseUrl}/me/timetable`, () =>
        HttpResponse.json(timetable),
      ),
    );

    renderApp("/");

    await screen.findByRole("heading", { name: "Your day at a glance" });
    const laterPanel = screen.getByRole("heading", { name: "Later today" })
      .closest("section");
    expect(await within(laterPanel as HTMLElement).findByText("No more classes scheduled today")).toBeInTheDocument();
    expect(within(laterPanel as HTMLElement).queryByText("Nothing scheduled today")).not.toBeInTheDocument();
    expect(
      screen.getByText("Classes today").closest(".summary-item"),
    ).toHaveTextContent("1 class");
  });

  it("supports entering and submitting a check-in code once", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/check-in");
    await user.click(
      await screen.findByRole("button", { name: "Share location" }),
    );
    expect(await screen.findByText("Location ready")).toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      "381204",
    );
    const button = screen.getByRole("button", { name: /Check in to class/ });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(
      await screen.findByRole("heading", { name: /You're checked in/ }),
    ).toBeInTheDocument();
  });

  it("filters classes by department", async () => {
    const user = userEvent.setup();
    renderApp("/find-classes");
    const departmentFilter = await screen.findByRole("combobox", {
      name: "Filter by department",
    });
    await screen.findByRole("option", { name: "General Studies" });
    await user.selectOptions(departmentFilter, "General Studies");
    expect(
      screen.getByRole("heading", { name: "General Studies" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Computer Architecture" }),
    ).not.toBeInTheDocument();
  });

  it("shows API-backed empty states for a student with no courses or classes", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const emptyLive: LiveClassesResponse = { items: [] };
    const emptyTimetable: StudentTimetableResponse = {
      date: "2026-10-21",
      items: [],
    };
    const emptyCourses: StudentCoursesResponse = { items: [] };
    server.use(
      http.get(`${apiBaseUrl}/me/live-classes`, () =>
        HttpResponse.json(emptyLive),
      ),
      http.get(`${apiBaseUrl}/me/timetable`, () =>
        HttpResponse.json(emptyTimetable),
      ),
      http.get(`${apiBaseUrl}/me/courses`, () =>
        HttpResponse.json(emptyCourses),
      ),
    );
    renderApp("/");

    expect(
      await screen.findByText("No class is live right now"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled today")).toBeInTheDocument();
    expect(
      screen.getAllByText("You haven't registered for any courses yet"),
    ).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Find classes" })).not.toHaveLength(
      0,
    );
  });

  it("registers or requests a class through the API and shows pending status", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const requests: string[] = [];
    server.use(
      http.post(`${apiBaseUrl}/offerings/:id/registrations`, ({ params }) => {
        requests.push(String(params.id));
        return HttpResponse.json(
          {
            student_id: "20000000-0000-4000-8000-000000000001",
            status: "pending",
            on_roster: false,
          },
          { status: 201 },
        );
      }),
    );
    renderApp("/find-classes");

    await user.click(
      await screen.findByRole("button", { name: "Request to join" }),
    );
    expect(
      await screen.findByText("Pending approval"),
    ).toBeInTheDocument();
    expect(requests).toEqual(["10000000-0000-4000-8000-000000000305"]);
    expect(
      screen.getByRole("button", { name: "Request pending" }),
    ).toBeDisabled();
  });

  it("shows a failed student API request and offers retry", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    server.use(
      http.get(`${apiBaseUrl}/me/courses`, () =>
        HttpResponse.json(
          {
            error: {
              code: "student_courses_unavailable",
              message: "Course service is unavailable.",
              details: {},
            },
          },
          { status: 500 },
        ),
      ),
    );
    renderApp("/courses");

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("student_courses_unavailable");
    expect(
      screen.getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });

  it("loads attendance history for the selected course offering", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const requestedIds: string[] = [];
    const attendance: StudentAttendanceResponse = {
      items: [
        {
          session_id: "30000000-0000-4000-8000-000000000001",
          date: "2026-10-20",
          status: "excused",
          classification: "excused",
          override_reason: "Medical approval",
        },
      ],
    };
    server.use(
      http.get(`${apiBaseUrl}/me/attendance`, ({ request }) => {
        requestedIds.push(
          new URL(request.url).searchParams.get("offering_id") ?? "",
        );
        return HttpResponse.json(attendance);
      }),
    );
    renderApp("/history");

    const courseSelect = await screen.findByRole("combobox", {
      name: "Attendance history course",
    });
    await waitFor(() => expect(courseSelect).toBeEnabled());
    await user.selectOptions(
      courseSelect,
      "10000000-0000-4000-8000-000000000201",
    );
    expect(await screen.findByText(/Medical approval/)).toBeInTheDocument();
    expect(requestedIds).toContain(
      "10000000-0000-4000-8000-000000000201",
    );
  });

  it("shows scanner coverage loss and the fixed-code banner", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp(demoSessionPath("/lecturer/live"));
    await waitFor(
      () =>
        expect(screen.getByRole("main")).toHaveTextContent(
          "Engineering Mathematics III",
        ),
      { timeout: 5000 },
    );

    await user.selectOptions(
      await screen.findByRole("combobox", {
        name: "Mock live screen scenario",
      }),
      "scanner_offline",
    );
    expect(screen.getByText(/Scanner offline from 09:31/)).toBeInTheDocument();

    try {
      await user.click(
        await screen.findByRole("button", { name: "Switch to fixed code" }),
      );
      await waitFor(() =>
        expect(document.querySelector(".fixed-code-banner")).toBeTruthy(),
      );
      expect(
        document.querySelector(".fixed-code-banner")?.textContent,
      ).toContain("Fixed code in use.");
      expect(
        screen.queryByRole("button", { name: "Switch to fixed code" }),
      ).not.toBeInTheDocument();
    } finally {
      confirm.mockRestore();
    }
  });

  it("renders board mode code and requests a wake lock when available", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue({ release: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    renderApp(demoSessionPath("/lecturer/live"));

    await user.click(
      (await screen.findAllByRole("button", { name: "Board mode" }))[0]!,
    );

    const board = screen.getByRole("region", { name: "Board mode" });
    expect(board).toBeInTheDocument();
    expect(within(board).getByText("381 204")).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("persists the selected theme across app reloads", async () => {
    const user = userEvent.setup();
    const view = renderApp();
    await screen.findByRole("heading", { name: "Your day at a glance" });
    const themeSelect = view.container.querySelector("#theme-select");
    if (!(themeSelect instanceof HTMLSelectElement))
      throw new Error("Theme selector is not rendered.");
    await user.selectOptions(themeSelect, "dark");
    expect(localStorage.getItem("campuscheck-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("requires an explanation for other bulk override reasons", async () => {
    const user = userEvent.setup();
    renderApp("/lecturer/report");
    await user.click(
      await waitFor(
        () =>
          screen.getByRole("checkbox", {
            name: "Select all visible students",
          }),
        { timeout: 5000 },
      ),
    );
    await user.click(
      await screen.findByRole("button", { name: "Override selected (6)" }),
    );
    expect(
      screen.getByRole("heading", { name: "Override 6 records?" }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Reason" }),
      "other",
    );
    const confirm = screen.getByRole("button", {
      name: "Confirm audited change",
    });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Explain why (required)" }),
      "Power outage prevented scanning",
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    const results = await screen.findByText(/2021-18420: saved/);
    for (const studentId of [
      "2021-18420",
      "2021-19422",
      "2021-20117",
      "2021-18653",
      "2021-17703",
      "2021-19401",
    ]) {
      expect(results.parentElement).toHaveTextContent(`${studentId}: saved`);
    }
  });

  it("renders the paper attendance roster", async () => {
    renderApp("/lecturer/print-sheet");
    expect(
      await screen.findByRole("heading", { name: "Paper attendance sheet" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Amara Okafor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2021 / 19422").length).toBeGreaterThan(0);
  });

  it("starts a session, polls its returned code, and ends that session", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const offeringId = getDemoState().offerings[0]?.id;
    const venueId = "3f2b8c1e-5a7d-4c1b-9e2a-8d6f4a1b7c90";
    if (!offeringId) throw new Error("The mock API has no seeded offering.");
    const sessionId = "b9d3bc38-d5e3-4a6c-8a67-6e4e4130d176";
    const session: StartSessionResponse["session"] = {
      id: sessionId,
      offering_id: offeringId,
      venue_id: venueId,
      started_at: "2026-10-20T08:00:00Z",
      latitude: 7.5172,
      longitude: 4.5226,
      radius_meters: 60,
      rotating_code: false,
      late_after_min: 17,
    };
    const response: StartSessionResponse = {
      session,
      code: "928361",
      seconds_remaining: 22,
    };
    let startBody: unknown;
    let contentType: string | null = null;
    const codeSessionIds: string[] = [];
    const endedSessionIds: string[] = [];
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    server.use(
      http.post(`${apiBaseUrl}/sessions`, async ({ request }) => {
        startBody = await request.json();
        contentType = request.headers.get("Content-Type");
        return HttpResponse.json(response, { status: 201 });
      }),
      http.get(`${apiBaseUrl}/sessions/:id/code`, ({ params }) => {
        codeSessionIds.push(String(params.id));
        const codeResponse: SessionCodeResponse = {
          ...response,
          seconds_remaining: 22,
        };
        return HttpResponse.json(codeResponse);
      }),
      http.post(`${apiBaseUrl}/sessions/:id/end`, ({ params }) => {
        endedSessionIds.push(String(params.id));
        return HttpResponse.json(session satisfies EndSessionResponse);
      }),
    );
    renderApp("/lecturer/start", true, "lecturer");
    await waitFor(
      () =>
        expect(screen.getByRole("main")).toHaveTextContent(
          "Start an attendance session",
        ),
      { timeout: 5000 },
    );

    const offeringSelect = await screen.findByRole("combobox", {
      name: "Offering",
    });
    expect(
      within(offeringSelect).getByRole("option", {
        name: "ENG 301 · Engineering Mathematics III",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(offeringSelect, offeringId);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Venue" }),
      venueId,
    );
    await user.clear(
      screen.getByRole("spinbutton", { name: "Mark late after (minutes)" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Mark late after (minutes)" }),
      "17",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Use rotating attendance code" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Start session" }),
    );

    await waitFor(
      () => expect(screen.getByText("928 361")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(startBody).toEqual({
      offering_id: offeringId,
      venue_id: venueId,
      rotating_code: false,
      late_after_min: 17,
    } satisfies StartSessionRequest);
    expect(contentType).toBe("application/json");
    expect(window.location.pathname).toBe("/lecturer/live");
    expect(window.location.search).toBe(
      `?sessionId=${encodeURIComponent(sessionId)}`,
    );
    await waitFor(() => expect(codeSessionIds).toContain(sessionId));

    await user.click(screen.getByRole("button", { name: "End session" }));
    await waitFor(() => expect(endedSessionIds).toContain(sessionId));
    confirm.mockRestore();
  });

  it("shows API field errors beside the start-session form", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    server.use(
      http.post(`${apiBaseUrl}/sessions`, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_request",
              message: "The venue is not available.",
              details: {
                fields: {
                  venue_id: ["Choose a venue in your institution."],
                  late_after_min: "Must be a whole number.",
                },
              },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderApp("/lecturer/start");
    await user.click(
      await screen.findByRole("button", { name: "Start session" }),
    );
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(
      "invalid_request: The venue is not available.",
    );
    expect(error).toHaveTextContent(
      "venue_id: Choose a venue in your institution.",
    );
    expect(error).toHaveTextContent("late_after_min: Must be a whole number.");
  });

  it("checks in against the selected live class session ID", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/lecturer/start");
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Start session" },
        { timeout: 5000 },
      ),
    );
    await waitFor(() =>
      expect(getDemoState().sessions).toHaveLength(2),
    );
    await waitFor(
      () => expect(screen.getByText("726 519")).toBeInTheDocument(),
      { timeout: 5000 },
    );

    const createdSession = getDemoState().sessions.at(-1);
    if (!createdSession)
      throw new Error("The mock API did not create an attendance session.");
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(
      await screen.findByRole("button", { name: "Sign in as Student" }),
    );
    await user.click(
      await screen.findByRole("link", { name: /Check in to class/ }),
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Live class" }),
      createdSession.id,
    );
    await user.click(screen.getByRole("button", { name: "Share location" }));
    await screen.findByText("Location ready");
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      createdSession.code,
    );
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));
    await screen.findByRole("heading", { name: /You're checked in/ });

    expect(
      getDemoState().attendance.find(
        (record) =>
          record.studentId === "2021-18420" &&
          record.sessionId === createdSession.id,
      )?.webTime,
    ).not.toBe("—");
  });

  it("requires a mock session, opens the selected role dashboard, and logs out", async () => {
    const user = userEvent.setup();
    expect(getMockSession()).toBeNull();
    renderApp("/", false);

    expect(
      await screen.findByRole("heading", { name: "Sign in to your account" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Your workspace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log out and reset demo" }),
    ).toBeInTheDocument();

    const accounts = [
      {
        label: "Student",
        role: "student",
        heading: "Your day at a glance",
      },
      {
        label: "Lecturer",
        role: "lecturer",
        heading: /Welcome, Dr\. Ngozi Eze/,
      },
      {
        label: "Department admin",
        role: "department-admin",
        heading: "Department dashboard",
      },
      {
        label: "Institution admin",
        role: "institution-admin",
        heading: "Institution dashboard",
      },
    ] as const;

    for (const account of accounts) {
      await user.click(
        screen.getByRole("button", { name: `Sign in as ${account.label}` }),
      );
      expect(
        await screen.findByRole("heading", { name: account.heading }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: "Your workspace" }),
      ).not.toBeInTheDocument();
      expect(document.querySelector(".app-shell")).toHaveAttribute(
        "data-role",
        account.role,
      );
      if (account.role === "student")
        expect(
          screen.getByRole("navigation", { name: "Student navigation" }),
        ).toBeInTheDocument();
      else
        expect(
          screen.queryByRole("navigation", { name: "Student navigation" }),
        ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Log out" }));
      expect(
        await screen.findByRole("heading", {
          name: "Sign in to your account",
        }),
      ).toBeInTheDocument();
    }
    expect(getMockSession()).toBeNull();
    expect(sessionStorage.getItem("campuscheck-mock-role")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Log out and reset demo" }),
    );
    expect(getMockSession()).toBeNull();
    expect(sessionStorage.getItem("campuscheck-mock-role")).toBeNull();
  });

  it("routes after login using the role returned by GET /me", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const profile: CurrentUser = {
      id: "20000000-0000-4000-8000-000000000009",
      name: "Morgan Admin",
      email: "morgan@example.test",
      status: "active",
      must_change_password: false,
      roles: [
        {
          role: "institution_admin",
          scope_type: "institution",
          scope_id: null,
        },
      ],
    };
    server.use(
      http.get(`${apiBaseUrl}/me`, () => HttpResponse.json(profile)),
    );
    renderApp("/", false);

    await user.click(
      await screen.findByRole("button", { name: "Sign in as Student" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Institution dashboard" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).toHaveAttribute(
      "data-role",
      "institution-admin",
    );
    expect(screen.getByLabelText("Signed-in user")).toHaveTextContent(
      "Morgan Admin",
    );
  });

  it("redirects a user without the required role to 403 and their home", async () => {
    const user = userEvent.setup();
    renderApp("/lecturer", true, "student");

    expect(
      await screen.findByRole("heading", {
        name: "You don't have access to this page",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to your home" }));
    expect(
      await screen.findByRole("heading", { name: "Your day at a glance" }),
    ).toBeInTheDocument();
  });

  it("shows the GET /me name, department ID, and level in app bar and profile", async () => {
    renderApp("/profile");

    expect(
      await screen.findByRole("heading", { name: "Amara Okafor" }),
    ).toBeInTheDocument();
    const identity = screen.getByLabelText("Signed-in user");
    expect(identity).toHaveTextContent("Amara Okafor");
    expect(identity).toHaveTextContent(
      "10000000-0000-4000-8000-000000000003",
    );
    expect(identity).toHaveTextContent("Level 300");
    const details = screen.getByRole("region", { name: "Profile details" });
    expect(details).toHaveTextContent("Department ID");
    expect(details).toHaveTextContent("Level");
    expect(details).toHaveTextContent("300");
  });

  it("shares check-ins and lecturer overrides across roles and resets demo data", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/check-in");

    await user.click(
      await screen.findByRole("button", { name: "Share location" }),
    );
    await screen.findByText("Location ready");
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      "381204",
    );
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));
    await screen.findByRole("heading", { name: /You're checked in/ });
    expect(getDemoState().attendance[0]?.webTime).not.toBe("09:07");

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(
      await screen.findByRole("button", { name: "Sign in as Lecturer" }),
    );
    expect(
      await screen.findByRole("heading", { name: /Welcome, Dr\. Ngozi Eze/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Session reports" }));
    const amaraRow = await screen.findByRole("row", { name: /Amara Okafor/ });
    const recordedTime = getDemoState().attendance.find(
      (record) => record.studentId === "2021-18420",
    )?.webTime;
    if (!recordedTime)
      throw new Error("The demo check-in time was not recorded.");
    expect(recordedTime).toMatch(/^\d{1,2}:\d{2}$/);
    expect(within(amaraRow).getAllByText(recordedTime)).not.toHaveLength(0);
    await user.click(
      within(amaraRow).getByRole("button", { name: "Override" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "New attendance status" }),
      "excused",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm audited change" }),
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(
      await screen.findByRole("button", { name: "Sign in as Student" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Your day at a glance" }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("link", { name: "Attendance" })[0]!);
    expect(
      await screen.findByRole("heading", { name: "Attendance history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Excused")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset demo data" }));
    expect(getDemoState().attendance[0]?.status).toBe("verified");
    expect(getDemoState().attendance[0]?.webTime).toBe("09:07");
  });
});
