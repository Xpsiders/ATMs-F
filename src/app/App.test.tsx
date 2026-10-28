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
  CreateCourseRequest,
  CreateOfferingRequest,
  CatalogueListResponse,
  DepartmentCatalogueResponse,
  EndSessionResponse,
  LiveClassesResponse,
  OfferingLecturersResponse,
  OfferingsResponse,
  SearchOfferingsResponse,
  SemestersResponse,
  SessionCodeResponse,
  StartSessionRequest,
  StartSessionResponse,
  SetOfferingLecturersRequest,
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
import { getDemoState, resetDemoData, updateDemoState } from "@/mocks/store";

vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: vi
    .fn()
    .mockResolvedValue({ lat: 6.5, lng: 3.4, accuracy: 20 }),
  tryGetCurrentPosition: vi
    .fn()
    .mockResolvedValue({ lat: 6.5, lng: 3.4, accuracy: 20 }),
  GeoError: class GeoError extends Error {},
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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

  it("lets a student log out from the student page", async () => {
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByRole("button", {
        name: "Log out of student account",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Log out of student account" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Sign in to your account",
      }),
    ).toBeInTheDocument();
    expect(getMockSession()).toBeNull();
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
          session_open: false,
          next_timetable_slot: null,
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
      await screen.findByRole(
        "heading",
        {
          name: "Welcome, Dr. Ngozi Eze",
        },
        { timeout: 5_000 },
      ),
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
    await waitFor(() =>
      expect(offeringSelect).toHaveValue(assignedOfferings.items[0]!.id),
    );
    expect(window.location.pathname).toBe("/lecturer/start");
    expect(
      screen.getByRole("link", { name: "CampusCheck home" }),
    ).toHaveAttribute("href", "/lecturer");
  });

  it("renders the home screen from backend live, timetable, and course data", async () => {
    // Freeze to mid-day Lagos so relative slot times never wrap past midnight
    // (only Date is faked, so debounce/async timers stay real). CI runs in UTC
    // at arbitrary times, which otherwise makes this time-of-day dependent.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T11:00:00Z") });
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
    const livePanel = screen
      .getByRole("heading", { name: "Live now" })
      .closest("section");
    expect(livePanel).toHaveTextContent("Backend Live Course");
    expect(livePanel).toHaveTextContent("Backend Lecture Hall");
    expect(livePanel).toHaveTextContent("Checked in");
    expect(
      within(livePanel as HTMLElement).queryByRole("link", {
        name: /Check in/,
      }),
    ).not.toBeInTheDocument();

    const laterPanel = screen
      .getByRole("heading", { name: "Later today" })
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
    expect(
      screen.getByText("API 404 · Backend Attendance Course"),
    ).toBeInTheDocument();
    await screen.findByText("43%");
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(
      screen.getByText(/Below the 60% attendance requirement/),
    ).toBeInTheDocument();
  });

  it("does not call a populated past timetable empty", async () => {
    // Freeze to mid-day Lagos so "minutes ago" never wraps to the previous day.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T11:00:00Z") });
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
    const laterPanel = screen
      .getByRole("heading", { name: "Later today" })
      .closest("section");
    expect(
      await within(laterPanel as HTMLElement).findByText(
        "No more classes scheduled today",
      ),
    ).toBeInTheDocument();
    expect(
      within(laterPanel as HTMLElement).queryByText("Nothing scheduled today"),
    ).not.toBeInTheDocument();
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

  it("loads department filters independently of the search result defaults", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const departmentId = "10000000-0000-4000-8000-000000000811";
    const departments: DepartmentCatalogueResponse = {
      items: [{ id: departmentId, name: "Backend Department" }],
      limit: 1,
      offset: 0,
      has_more: false,
    };
    const offering: SearchOfferingsResponse["items"][number] = {
      offering_id: "10000000-0000-4000-8000-000000000812",
      course_id: "10000000-0000-4000-8000-000000000813",
      course_code: "API 811",
      course_title: "Backend Department Course",
      department_id: departmentId,
      department_name: "Backend Department",
      level: 300,
      kind: "departmental",
      registration_mode: "open",
      lecturers: ["Dr. API Lecturer"],
      registration_status: "none",
      is_registered: false,
      is_pending: false,
    };
    const requestedDepartments: string[] = [];
    server.use(
      http.get(`${apiBaseUrl}/departments`, () =>
        HttpResponse.json(departments),
      ),
      http.get(`${apiBaseUrl}/offerings/search`, ({ request }) => {
        const requestedDepartment =
          new URL(request.url).searchParams.get("department_id") ?? "";
        requestedDepartments.push(requestedDepartment);
        return HttpResponse.json({
          items: requestedDepartment === departmentId ? [offering] : [],
          limit: 50,
          offset: 0,
          has_more: false,
        } satisfies SearchOfferingsResponse);
      }),
    );
    renderApp("/find-classes");

    const departmentFilter = await screen.findByRole("combobox", {
      name: "Filter by department",
    });
    await screen.findByRole("option", { name: "Backend Department" });
    await user.selectOptions(departmentFilter, departmentId);
    // The department filter is a search refinement: it only reaches
    // /offerings/search once a search term is entered (the endpoint 400s on an
    // empty q, so the default view uses GET /me/offerings instead).
    await user.type(
      screen.getByRole("textbox", { name: "Search classes" }),
      "Course",
    );

    expect(
      await screen.findByRole("heading", {
        name: "Backend Department Course",
      }),
    ).toBeInTheDocument();
    expect(requestedDepartments).toContain(departmentId);
  });

  it("browses /me/offerings by default and only searches once a term is typed", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    let myOfferingsCalled = false;
    const searchQueries: string[] = [];
    server.use(
      http.get(`${apiBaseUrl}/me/offerings`, () => {
        myOfferingsCalled = true;
        return HttpResponse.json({
          items: [
            {
              id: "10000000-0000-4000-8000-000000000901",
              offering_id: "10000000-0000-4000-8000-000000000901",
              course_code: "SCP 901",
              course_title: "My Scoped Offering",
              department_id: "10000000-0000-4000-8000-000000000902",
              department_name: "My Department",
              level: 300,
              kind: "departmental",
              registration_mode: "open",
              lecturers: ["Dr. Scope"],
              registration_status: "none",
              is_registered: false,
              is_pending: false,
              session_open: false,
              next_timetable_slot: null,
            },
          ],
          limit: 100,
          offset: 0,
          has_more: false,
        });
      }),
      http.get(`${apiBaseUrl}/offerings/search`, ({ request }) => {
        searchQueries.push(new URL(request.url).searchParams.get("q") ?? "");
        return HttpResponse.json({
          items: [
            {
              offering_id: "10000000-0000-4000-8000-000000000911",
              course_id: "10000000-0000-4000-8000-000000000912",
              course_code: "SRCH 911",
              course_title: "Searched Offering",
              department_id: "10000000-0000-4000-8000-000000000913",
              department_name: "Search Department",
              level: 200,
              kind: "general",
              registration_mode: "open",
              lecturers: ["Dr. Search"],
              registration_status: "none",
              is_registered: false,
              is_pending: false,
            },
          ],
          limit: 50,
          offset: 0,
          has_more: false,
        } satisfies SearchOfferingsResponse);
      }),
    );
    renderApp("/find-classes");

    // Default view loads from GET /me/offerings — never an empty-q search.
    expect(
      await screen.findByRole("heading", { name: "My Scoped Offering" }),
    ).toBeInTheDocument();
    expect(myOfferingsCalled).toBe(true);
    expect(searchQueries).toEqual([]);

    // Typing a term switches to GET /offerings/search with a non-empty q.
    await user.type(
      screen.getByRole("textbox", { name: "Search classes" }),
      "Searched",
    );
    expect(
      await screen.findByRole("heading", { name: "Searched Offering" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My Scoped Offering" }),
    ).not.toBeInTheDocument();
    expect(searchQueries).toContain("Searched");
    expect(searchQueries.every((q) => q.trim() !== "")).toBe(true);
  });

  it("marks a browse offering as registered when it is in the student's approved courses", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const offeringId = "10000000-0000-4000-8000-000000000901";
    server.use(
      http.get(`${apiBaseUrl}/me/offerings`, () =>
        HttpResponse.json({
          items: [
            {
              id: offeringId,
              offering_id: offeringId,
              course_code: "SCP 901",
              course_title: "My Scoped Offering",
              department_id: "10000000-0000-4000-8000-000000000902",
              department_name: "My Department",
              level: 300,
              kind: "departmental",
              registration_mode: "open",
              lecturers: ["Dr. Scope"],
              session_open: false,
              next_timetable_slot: null,
            },
          ],
          limit: 100,
          offset: 0,
          has_more: false,
        }),
      ),
      // /me/offerings carries no registration status; the approved registration
      // is only known via /me/courses — the same source the dashboard reads.
      http.get(`${apiBaseUrl}/me/courses`, () =>
        HttpResponse.json({
          items: [
            {
              offering_id: offeringId,
              course_code: "SCP 901",
              course_title: "My Scoped Offering",
              lecturer_names: ["Dr. Scope"],
              sessions_held: 0,
              sessions_attended: 0,
              attendance_percentage: 0,
              minimum_attendance_percentage: 75,
              below_threshold: false,
            },
          ],
        }),
      ),
    );
    renderApp("/find-classes");

    expect(
      await screen.findByRole("heading", { name: "My Scoped Offering" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Registered" }),
    ).toBeDisabled();
  });

  it("shows the backend closed-registration state with its disabled explanation", async () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const closedOffering: SearchOfferingsResponse["items"][number] = {
      offering_id: "10000000-0000-4000-8000-000000000821",
      course_id: "10000000-0000-4000-8000-000000000822",
      course_code: "API 821",
      course_title: "Closed Backend Offering",
      department_id: "10000000-0000-4000-8000-000000000823",
      department_name: "Backend Department",
      level: 300,
      kind: "departmental",
      registration_mode: "closed",
      lecturers: ["Dr. API Lecturer"],
      registration_status: "none",
      is_registered: false,
      is_pending: false,
    };
    server.use(
      http.get(`${apiBaseUrl}/offerings/search`, () =>
        HttpResponse.json({
          items: [closedOffering],
          limit: 50,
          offset: 0,
          has_more: false,
        } satisfies SearchOfferingsResponse),
      ),
    );
    renderApp("/find-classes");

    const button = await screen.findByRole("button", {
      name: "Registration closed",
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Registration is closed for this offering."),
    ).toBeInTheDocument();
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
    expect(
      screen.getAllByRole("link", { name: "Find classes" }),
    ).not.toHaveLength(0);
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
    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "student_courses_unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
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
    expect(requestedIds).toContain("10000000-0000-4000-8000-000000000201");
  });

  it("shows scoped courses and assigned lecturers to a department admin", async () => {
    renderApp("/courses", true, "department-admin");

    expect(
      await screen.findByRole(
        "heading",
        { name: "Courses & offerings" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /Engineering Mathematics III/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dr. Ngozi Eze")).toBeInTheDocument();
    expect(screen.getByText("Mr. Chidi Obi")).toBeInTheDocument();
    expect(
      screen.getByText(
        /not a directory of staff who have no courses assigned/i,
      ),
    ).toBeInTheDocument();
  });

  it("deletes a course that has no offerings", async () => {
    const user = userEvent.setup();
    renderApp("/courses", true, "department-admin");
    await screen.findByRole(
      "heading",
      { name: "Courses & offerings" },
      { timeout: 5_000 },
    );

    const courseSelect = await screen.findByRole("combobox", { name: "Course" });
    await waitFor(() => expect(courseSelect).toBeEnabled());
    await user.selectOptions(
      courseSelect,
      within(courseSelect).getByRole("option", { name: /CSC 110/ }),
    );
    await user.click(screen.getByRole("button", { name: "Delete course" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete course" }),
    );

    expect(await screen.findByText(/was deleted\./)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: /CSC 110/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("blocks deleting a course that still has offerings", async () => {
    const user = userEvent.setup();
    renderApp("/courses", true, "department-admin");
    await screen.findByRole(
      "heading",
      { name: "Courses & offerings" },
      { timeout: 5_000 },
    );

    const courseSelect = await screen.findByRole("combobox", { name: "Course" });
    await waitFor(() => expect(courseSelect).toBeEnabled());
    await user.selectOptions(
      courseSelect,
      within(courseSelect).getByRole("option", { name: /ENG 301/ }),
    );
    await user.click(screen.getByRole("button", { name: "Delete course" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete course" }),
    );

    expect(
      await screen.findByText(
        /Remove this course's offerings before deleting it\./,
      ),
    ).toBeInTheDocument();
  });

  it("deletes an offering, then the freed course can be deleted", async () => {
    const user = userEvent.setup();
    renderApp("/courses", true, "department-admin");
    await screen.findByRole(
      "heading",
      { name: "Courses & offerings" },
      { timeout: 5_000 },
    );

    // Remove the ENG 301 offering first.
    await user.click(
      await screen.findByRole("button", { name: "Delete offering ENG 301" }),
    );
    const offeringDialog = await screen.findByRole("dialog");
    await user.click(
      within(offeringDialog).getByRole("button", { name: "Delete offering" }),
    );
    expect(
      await screen.findByText(/\(offering\) was deleted\./),
    ).toBeInTheDocument();

    // The course is now offering-free and can be deleted on its own.
    const courseSelect = await screen.findByRole("combobox", { name: "Course" });
    await waitFor(() => expect(courseSelect).toBeEnabled());
    await user.selectOptions(
      courseSelect,
      await within(courseSelect).findByRole("option", { name: /ENG 301/ }),
    );
    await user.click(screen.getByRole("button", { name: "Delete course" }));
    const courseDialog = await screen.findByRole("dialog");
    await user.click(
      within(courseDialog).getByRole("button", { name: "Delete course" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: /ENG 301/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("lists teaching requests and approves one as a scoped admin", async () => {
    const user = userEvent.setup();
    renderApp("/admin/teaching-requests", true, "department-admin");

    expect(
      await screen.findByRole(
        "heading",
        { name: "Teaching requests" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/CPE 305 — Computer Architecture/),
    ).toBeInTheDocument();
    expect(screen.getByText("Dr. Ngozi Eze")).toBeInTheDocument();

    await user.click(screen.getByRole("radio"));
    await user.click(screen.getByRole("button", { name: "Approve request" }));

    expect(
      await screen.findByText(
        /Teaching request approved; the offering has been created\./,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/no pending teaching requests/i),
    ).toBeInTheDocument();
  });

  it("lists scanners and shows a provisioned pairing code once", async () => {
    const user = userEvent.setup();
    renderApp("/scanners", true, "department-admin");

    expect(
      await screen.findByRole(
        "heading",
        { name: "Scanners", level: 1 },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("LT 2 entrance scanner"),
    ).toBeInTheDocument();
    expect(screen.getByText("Awaiting pairing")).toBeInTheDocument();

    const venueSelect = screen.getByRole("combobox", { name: "Venue" });
    await user.selectOptions(
      venueSelect,
      within(venueSelect).getByRole("option", { name: "LT 2" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Scanner name" }),
      "New gate scanner",
    );
    await user.click(
      screen.getByRole("button", { name: "Provision scanner" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Pairing code" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/It will not be shown again\./),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Pairing code").textContent).toMatch(
      /[A-Z0-9]{4}-[A-Z0-9]{4}/,
    );
  });

  it("enrols a student on a scanner and reports the slot", async () => {
    const user = userEvent.setup();
    renderApp("/scanners", true, "department-admin");

    await screen.findByRole(
      "heading",
      { name: "Scanners", level: 1 },
      { timeout: 5_000 },
    );
    await screen.findByText("LT 2 entrance scanner");

    await user.click(
      screen.getAllByRole("button", { name: "Enrol student" })[0]!,
    );
    const picker = screen.getByRole("combobox", { name: "Student to enrol" });
    await user.type(picker, "Amara");
    await user.click(
      await screen.findByRole("option", { name: /Amara Okafor/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Queue enrolment" }),
    );

    expect(
      await screen.findByText(/Queued on slot 1/),
    ).toBeInTheDocument();
  });

  it("shows scoped courses and assigned lecturers to a faculty admin", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    let createdDepartmentId = "";
    const semesterId = "30000000-0000-4000-8000-000000000004";
    server.use(
      http.get(`${apiBaseUrl}/semesters`, () =>
        HttpResponse.json({
          items: [{ id: semesterId, name: "Semester 1" }],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies SemestersResponse),
      ),
      http.post(`${apiBaseUrl}/courses`, async ({ request }) => {
        const payload = (await request.json()) as CreateCourseRequest;
        createdDepartmentId = payload.department_id;
        return HttpResponse.json(
          { id: "30000000-0000-4000-8000-000000000002" },
          { status: 201 },
        );
      }),
      http.post(`${apiBaseUrl}/offerings`, () =>
        HttpResponse.json(
          { id: "30000000-0000-4000-8000-000000000005" },
          { status: 201 },
        ),
      ),
    );
    renderApp("/courses", true, "faculty-admin");

    expect(
      await screen.findByRole(
        "heading",
        { name: "Courses & offerings" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /Engineering Mathematics III/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dr. Ngozi Eze")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Course code"), "CPE 401");
    await user.type(screen.getByLabelText("Course title"), "Advanced Design");
    await user.selectOptions(
      screen.getByLabelText("Department"),
      "10000000-0000-4000-8000-000000000004",
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Semester" }),
      semesterId,
    );
    await user.click(screen.getByRole("button", { name: "Create course" }));
    expect(
      await screen.findByText("CPE 401 is now available for Semester 1."),
    ).toBeInTheDocument();
    expect(createdDepartmentId).toBe("10000000-0000-4000-8000-000000000004");
  });

  it("adds a lecturer without replacing the offering's current assignments", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const offeringId = "4c39d74e-7b7c-4cb0-8bd5-c8274905e3ce";
    let assignedIds = ["20000000-0000-4000-8000-000000000002"];
    let submittedIds: string[] = [];
    server.use(
      http.get(`${apiBaseUrl}/offerings/${offeringId}/lecturers`, () =>
        HttpResponse.json(
          assignedIds.map((id) => ({
            id,
            display_name:
              id === "20000000-0000-4000-8000-000000000002"
                ? "Dr. Ngozi Eze"
                : "Dr. Ada Okafor",
            email:
              id === "20000000-0000-4000-8000-000000000002"
                ? "ngozi.lecturer@campus.example"
                : "ada.okafor@example.com",
          })) satisfies OfferingLecturersResponse,
        ),
      ),
      http.put(
        `${apiBaseUrl}/offerings/${offeringId}/lecturers`,
        async ({ request }) => {
          const payload = (await request.json()) as SetOfferingLecturersRequest;
          submittedIds = payload.lecturer_ids;
          assignedIds = payload.lecturer_ids;
          return HttpResponse.json({ lecturer_ids: assignedIds });
        },
      ),
      http.get(`${apiBaseUrl}/users`, () =>
        HttpResponse.json({
          items: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              display_name: "Dr. Added Lecturer",
              email: "added.lecturer@campus.example",
              roles: [
                {
                  role: "lecturer",
                  scope_type: "department",
                  scope_id: "10000000-0000-4000-8000-000000000004",
                },
              ],
            },
          ],
          limit: 10,
          offset: 0,
          has_more: false,
        }),
      ),
    );
    renderApp("/courses", true, "department-admin");
    await screen.findByRole(
      "heading",
      { name: "Courses & offerings" },
      { timeout: 5_000 },
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Manage lecturers for ENG 301",
      }),
    );
    expect(
      await screen.findByText("ngozi.lecturer@campus.example"),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole("combobox", { name: "Lecturer" }),
      "Added",
    );
    await user.click(
      await screen.findByRole("option", { name: /Dr\. Added Lecturer/ }),
    );
    await user.click(screen.getByRole("button", { name: "Add lecturer" }));

    expect(
      await screen.findByText("Lecturer added to this offering."),
    ).toBeInTheDocument();
    expect(submittedIds).toEqual([
      "20000000-0000-4000-8000-000000000002",
      "20000000-0000-4000-8000-000000000010",
    ]);
    expect(await screen.findByText("Dr. Ada Okafor")).toBeInTheDocument();
  });

  it("searches the seeded lecturer directory across departments in the picker", async () => {
    const user = userEvent.setup();
    renderApp("/courses", true, "department-admin");
    await screen.findByRole(
      "heading",
      { name: "Courses & offerings" },
      { timeout: 5_000 },
    );
    const picker = screen.getByRole("combobox", { name: "Lecturer (optional)" });
    await user.type(picker, "Amara");
    expect(
      await screen.findByRole("option", { name: /Dr\. Amara Okafor/ }),
    ).toBeInTheDocument();
    await user.clear(picker);
    await user.type(picker, "Tunde");
    expect(
      await screen.findByRole("option", { name: /Dr\. Tunde Bello/ }),
    ).toBeInTheDocument();
  });

  it("creates a course using the selected department and generated API payload", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    let submitted: CreateCourseRequest | null = null;
    let submittedOffering: CreateOfferingRequest | null = null;
    let submittedLecturerIds: string[] = [];
    const semesterId = "30000000-0000-4000-8000-000000000104";
    server.use(
      http.get(`${apiBaseUrl}/semesters`, () =>
        HttpResponse.json({
          items: [{ id: semesterId, name: "Semester 1" }],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies SemestersResponse),
      ),
      http.post(`${apiBaseUrl}/courses`, async ({ request }) => {
        submitted = (await request.json()) as CreateCourseRequest;
        return HttpResponse.json(
          { id: "30000000-0000-4000-8000-000000000001" },
          { status: 201 },
        );
      }),
      http.post(`${apiBaseUrl}/offerings`, async ({ request }) => {
        submittedOffering = (await request.json()) as CreateOfferingRequest;
        return HttpResponse.json(
          { id: "30000000-0000-4000-8000-000000000105" },
          { status: 201 },
        );
      }),
      http.get(
        `${apiBaseUrl}/offerings/30000000-0000-4000-8000-000000000105/lecturers`,
        () => HttpResponse.json([] satisfies OfferingLecturersResponse),
      ),
      http.put(
        `${apiBaseUrl}/offerings/30000000-0000-4000-8000-000000000105/lecturers`,
        async ({ request }) => {
          const payload = (await request.json()) as SetOfferingLecturersRequest;
          submittedLecturerIds = payload.lecturer_ids;
          return HttpResponse.json({ lecturer_ids: payload.lecturer_ids });
        },
      ),
      http.get(`${apiBaseUrl}/users`, () =>
        HttpResponse.json({
          items: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              display_name: "Dr. Added Lecturer",
              email: "added.lecturer@campus.example",
              roles: [
                {
                  role: "lecturer",
                  scope_type: "department",
                  scope_id: "10000000-0000-4000-8000-000000000004",
                },
              ],
            },
          ],
          limit: 10,
          offset: 0,
          has_more: false,
        }),
      ),
    );
    renderApp("/courses", true, "department-admin");

    await screen.findByRole("heading", { name: "Courses & offerings" });
    await user.type(screen.getByLabelText("Course code"), "BIO 201");
    await user.type(screen.getByLabelText("Course title"), "Cell Biology");
    await user.selectOptions(screen.getByLabelText("Course kind"), "general");
    await user.type(screen.getByLabelText("Credits (optional)"), "3");
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "An introduction to cell structure.",
    );
    await user.type(
      screen.getByRole("combobox", { name: "Lecturer (optional)" }),
      "Added",
    );
    await user.click(
      await screen.findByRole("option", { name: /Dr\. Added Lecturer/ }),
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Semester" }),
      semesterId,
    );
    await user.click(screen.getByRole("button", { name: "Create course" }));

    expect(
      await screen.findByText(
        "BIO 201 is now available for Semester 1. The lecturer was assigned.",
      ),
    ).toHaveAttribute("role", "status");
    expect(submitted).toEqual({
      department_id: "10000000-0000-4000-8000-000000000004",
      code: "BIO 201",
      title: "Cell Biology",
      kind: "general",
      description: "An introduction to cell structure.",
      credits: 3,
    });
    expect(submittedOffering).toEqual({
      course_id: "30000000-0000-4000-8000-000000000001",
      semester_id: semesterId,
      level: 100,
      registration_mode: "open",
      roster_policy: "open",
      min_attendance_pct: 75,
      late_counts_as_attended: false,
    });
    expect(submittedLecturerIds).toEqual([
      "20000000-0000-4000-8000-000000000010",
    ]);
  });

  it("creates an offering and searches for it in the refreshed offerings list", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const courseId = "30000000-0000-4000-8000-000000000101";
    const semesterId = "30000000-0000-4000-8000-000000000102";
    let submitted: CreateOfferingRequest | null = null;
    let submittedLecturerIds: string[] = [];
    server.use(
      http.get(`${apiBaseUrl}/courses`, () =>
        HttpResponse.json({
          items: [
            {
              id: courseId,
              code: "CPE 499",
              title: "Advanced Systems",
              department_id: "10000000-0000-4000-8000-000000000004",
            },
          ],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies CatalogueListResponse),
      ),
      http.get(`${apiBaseUrl}/semesters`, () =>
        HttpResponse.json({
          items: [{ id: semesterId, name: "Semester 1" }],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies SemestersResponse),
      ),
      http.post(`${apiBaseUrl}/offerings`, async ({ request }) => {
        submitted = (await request.json()) as CreateOfferingRequest;
        return HttpResponse.json(
          { id: "30000000-0000-4000-8000-000000000103" },
          { status: 201 },
        );
      }),
      http.get(
        `${apiBaseUrl}/offerings/30000000-0000-4000-8000-000000000103/lecturers`,
        () => HttpResponse.json([] satisfies OfferingLecturersResponse),
      ),
      http.put(
        `${apiBaseUrl}/offerings/30000000-0000-4000-8000-000000000103/lecturers`,
        async ({ request }) => {
          const payload = (await request.json()) as SetOfferingLecturersRequest;
          submittedLecturerIds = payload.lecturer_ids;
          return HttpResponse.json({ lecturer_ids: payload.lecturer_ids });
        },
      ),
      http.get(`${apiBaseUrl}/users`, () =>
        HttpResponse.json({
          items: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              display_name: "Dr. Added Lecturer",
              email: "added.lecturer@campus.example",
              roles: [
                {
                  role: "lecturer",
                  scope_type: "department",
                  scope_id: "10000000-0000-4000-8000-000000000004",
                },
              ],
            },
          ],
          limit: 10,
          offset: 0,
          has_more: false,
        }),
      ),
      http.get(`${apiBaseUrl}/offerings/search`, ({ request }) => {
        const query = new URL(request.url).searchParams.get("q") ?? "";
        const items: SearchOfferingsResponse["items"] = query.includes(
          "CPE 499",
        )
          ? [
              {
                offering_id: "30000000-0000-4000-8000-000000000103",
                course_id: courseId,
                course_code: "CPE 499",
                course_title: "Advanced Systems",
                department_id: "10000000-0000-4000-8000-000000000004",
                department_name: "Computer Engineering",
                level: 400,
                kind: "departmental",
                registration_mode: "approval",
                lecturers: [],
                registration_status: "none",
                is_registered: false,
                is_pending: false,
                semester_id: semesterId,
                semester: "Semester 1",
                rank: 1,
              },
            ]
          : [];
        return HttpResponse.json({
          items,
          limit: 200,
          offset: 0,
          has_more: false,
        } satisfies SearchOfferingsResponse);
      }),
    );
    renderApp("/courses", true, "department-admin");

    await screen.findByRole("option", { name: /CPE 499 · Advanced Systems/ });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course" }),
      courseId,
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Semester" }),
      semesterId,
    );
    const levelInput = screen.getByRole("spinbutton", { name: "Level" });
    await user.clear(levelInput);
    await user.type(levelInput, "400");
    await user.click(screen.getByRole("radio", { name: "Needs approval" }));
    await user.type(
      screen.getByRole("combobox", { name: "Lecturer (optional)" }),
      "Added",
    );
    await user.click(
      await screen.findByRole("option", { name: /Dr\. Added Lecturer/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add course to semester" }),
    );

    expect(
      await screen.findByText(
        "CPE 499 is now available for Semester 1. The lecturer was assigned.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "CPE 499 · Advanced Systems",
      }),
    ).toBeInTheDocument();
    expect(submitted).toEqual({
      course_id: courseId,
      semester_id: semesterId,
      level: 400,
      registration_mode: "approval",
      roster_policy: "open",
      min_attendance_pct: 75,
      late_counts_as_attended: false,
    });
    expect(submittedLecturerIds).toEqual([
      "20000000-0000-4000-8000-000000000010",
    ]);
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
      http.get(`${apiBaseUrl}/me/offerings`, () =>
        HttpResponse.json({
          items: [
            {
              id: offeringId,
              course_code: "ENG 301",
              course_title: "Engineering Mathematics III",
              session_open: true,
              next_timetable_slot: null,
            },
          ],
          limit: 1,
          offset: 0,
          has_more: false,
        } satisfies OfferingsResponse),
      ),
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
      latitude: 6.5,
      longitude: 3.4,
      accuracy_meters: 20,
    } satisfies StartSessionRequest);
    expect(contentType).toBe("application/json");
    expect(window.location.pathname).toBe("/lecturer/live");
    expect(window.location.search).toBe(
      `?sessionId=${encodeURIComponent(sessionId)}`,
    );
    await waitFor(() => expect(codeSessionIds).toContain(sessionId));

    await user.click(screen.getByRole("link", { name: "My teaching" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Welcome, Dr. Ngozi Eze" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("link", {
        name: "View live ENG 301 · Engineering Mathematics III session",
      }),
    );
    expect(await screen.findByText("928 361")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer/live");
    expect(
      await screen.findByRole("button", { name: "End session" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End session" }));
    await waitFor(() => expect(endedSessionIds).toContain(sessionId));
    confirm.mockRestore();

    await user.click(screen.getByRole("link", { name: "Session reports" }));
    expect(await screen.findByText(`Session ${sessionId}`)).toBeInTheDocument();
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
    await waitFor(() => expect(getDemoState().sessions).toHaveLength(2));
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
    server.use(http.get(`${apiBaseUrl}/me`, () => HttpResponse.json(profile)));
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

  it("does not restore the session again while navigating between lecturer pages", async () => {
    const user = userEvent.setup();
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
    const profile: CurrentUser = {
      id: "20000000-0000-4000-8000-000000000002",
      name: "Dr. Ngozi Eze",
      email: "ngozi@example.test",
      status: "active",
      must_change_password: false,
      roles: [
        {
          role: "lecturer",
          scope_type: "department",
          scope_id: "10000000-0000-4000-8000-000000000004",
          department_id: "10000000-0000-4000-8000-000000000004",
        },
      ],
    };
    let profileRequests = 0;
    server.use(
      http.get(`${apiBaseUrl}/me`, () => {
        profileRequests += 1;
        return HttpResponse.json(profile);
      }),
    );
    renderApp("/", true, "lecturer");

    expect(
      await screen.findByRole("heading", { name: "Welcome, Dr. Ngozi Eze" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer");
    expect(profileRequests).toBe(1);

    await user.click(screen.getByRole("link", { name: "Live session" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Engineering Mathematics III" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer/live");

    await user.click(screen.getByRole("link", { name: "Session reports" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Session report" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer/report");

    await user.click(screen.getByRole("link", { name: "My teaching" }));
    await screen.findByRole("heading", { name: "Welcome, Dr. Ngozi Eze" });
    await user.click(screen.getByRole("link", { name: "Start a session" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Start an attendance session" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer/start");
    const startButton = await screen.findByRole(
      "button",
      { name: "Start session" },
      { timeout: 5000 },
    );
    expect(startButton).toBeEnabled();
    await user.click(startButton);
    expect(
      await screen.findByText("726 519", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/lecturer/live");
    const startedSessionId = new URLSearchParams(window.location.search).get(
      "sessionId",
    );
    expect(startedSessionId).toBeTruthy();
    expect(
      getDemoState().sessions.some(
        (session) => session.id === startedSessionId,
      ),
    ).toBe(true);
    expect(profileRequests).toBe(1);
  });

  it("redirects a user without the required role to 403 and their home", async () => {
    const user = userEvent.setup();
    renderApp("/lecturer", true, "student");

    expect(
      await screen.findByRole(
        "heading",
        {
          name: "You don't have access to this page",
        },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to your home" }));
    expect(
      await screen.findByRole("heading", { name: "Your day at a glance" }),
    ).toBeInTheDocument();
  });

  it("shows the GET /me name and email in the app bar and department details in profile", async () => {
    renderApp("/profile");

    expect(
      await screen.findByRole("heading", { name: "Amara Okafor" }),
    ).toBeInTheDocument();
    const identity = screen.getByLabelText("Signed-in user");
    expect(identity).toHaveTextContent("Amara Okafor");
    expect(identity).toHaveTextContent("amara.student@campus.example");
    expect(identity).not.toHaveTextContent(
      "10000000-0000-4000-8000-000000000003",
    );
    expect(identity).not.toHaveTextContent(
      "20000000-0000-4000-8000-000000000001",
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
