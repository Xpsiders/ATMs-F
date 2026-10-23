import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AcademicSessionsResponse,
  CreateAcademicSessionResponse,
  CreateOfferingRequest,
  SearchOfferingsResponse,
  VenueListResponse,
} from "@/api/contracts";
import {
  clearMockSession,
  resetDemoPasswordState,
  startMockSession,
} from "@/mocks/auth";
import { resetDemoData } from "@/mocks/store";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

afterEach(() => {
  clearMockSession();
  resetDemoData();
  resetDemoPasswordState();
  vi.unstubAllEnvs();
});

describe("new API mock handlers", () => {
  it("previews valid staff CSV rows and rejects invalid rows at atomic commit", async () => {
    const preview = await fetch(`${apiBaseUrl}/imports/staff/preview`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: [
        "staff_no,email,display_name,department_id",
        'ST-1,lecturer@example.test,"Dr Example, PhD",10000000-0000-4000-8000-000000000004',
      ].join("\n"),
    });
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      rows: [
        {
          line: 2,
          staff_no: "ST-1",
          email: "lecturer@example.test",
          display_name: "Dr Example, PhD",
        },
      ],
      errors: [],
    });

    const commit = await fetch(`${apiBaseUrl}/imports/staff`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: [
        "staff_no,email,display_name,department_id",
        "ST-2,not-an-email,Dr Invalid,10000000-0000-4000-8000-000000000004",
      ].join("\n"),
    });
    expect(commit.status).toBe(422);
    await expect(commit.json()).resolves.toMatchObject({
      rows: [],
      errors: [{ line: 2, column: "email" }],
    });
  });

  it("completes the one-time demo password reset endpoint flow", async () => {
    const body = {
      institution_id: "10000000-0000-4000-8000-000000000001",
      email: "amara.student@campus.example",
    };
    const request = await fetch(`${apiBaseUrl}/auth/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(request.status).toBe(202);

    const reset = await fetch(`${apiBaseUrl}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        code: "123456",
        new_password: "A-new-demo-password-2026",
      }),
    });
    expect(reset.status).toBe(200);

    const reusedCode = await fetch(`${apiBaseUrl}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        code: "123456",
        new_password: "Another-new-password-2026",
      }),
    });
    expect(reusedCode.status).toBe(400);
  });

  it("persists mock venues and academic-session mutations", async () => {
    const createVenue = await fetch(`${apiBaseUrl}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New lecture hall",
        latitude: 6.5,
        longitude: 3.4,
        radius_meters: 40,
      }),
    });
    expect(createVenue.status).toBe(201);
    const venueList = await fetch(`${apiBaseUrl}/venues`);
    const venueResponse: VenueListResponse = await venueList.json();
    expect(
      venueResponse.items.some(
        (venue) => venue.name === "New lecture hall" && venue.active,
      ),
    ).toBe(true);

    const createSession = await fetch(`${apiBaseUrl}/academic-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "2026/2027",
        starts_on: "2026-09-01",
        ends_on: "2027-06-30",
        current: true,
      }),
    });
    expect(createSession.status).toBe(201);
    const createdSession: CreateAcademicSessionResponse =
      await createSession.json();
    const list = await fetch(`${apiBaseUrl}/academic-sessions`);
    const sessions: AcademicSessionsResponse = await list.json();
    expect(
      sessions.items.some(
        (session) =>
          session.id === createdSession.id && session.name === "2026/2027",
      ),
    ).toBe(true);
  });

  it("creates courses through the scoped admin mock endpoint", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    startMockSession("department-admin");
    const outsideScope = await fetch(`${apiBaseUrl}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department_id: "10000000-0000-4000-8000-000000000005",
        code: "EE 401",
        title: "Power Systems",
      }),
    });
    expect(outsideScope.status).toBe(403);

    const create = await fetch(`${apiBaseUrl}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department_id: "10000000-0000-4000-8000-000000000004",
        code: "CPE 401",
        title: "Advanced Design",
        kind: "departmental",
      }),
    });
    expect(create.status).toBe(201);
    const created: { id: string } = await create.json();

    const list = await fetch(`${apiBaseUrl}/courses`);
    expect(list.status).toBe(200);
    const listed: { items: Array<Record<string, unknown>> } = await list.json();
    expect(listed.items).toContainEqual(
      expect.objectContaining({
        id: created.id,
        department_id: "10000000-0000-4000-8000-000000000004",
        code: "CPE 401",
        title: "Advanced Design",
      }),
    );
  });

  it("creates a mock offering and makes it searchable", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    startMockSession("department-admin");

    const session = await fetch(`${apiBaseUrl}/academic-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "2026/2027",
        starts_on: "2026-09-01",
        ends_on: "2027-06-30",
      }),
    });
    const academicSession: { id: string } = await session.json();
    const semester = await fetch(`${apiBaseUrl}/semesters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academic_session_id: academicSession.id,
        name: "Semester 1",
        starts_on: "2026-09-01",
        ends_on: "2026-12-31",
      }),
    });
    const createdSemester: { id: string } = await semester.json();

    const payload: CreateOfferingRequest = {
      course_id: "10000000-0000-4000-8000-000000000305",
      semester_id: createdSemester.id,
      level: 400,
      registration_mode: "approval",
      roster_policy: "registered_only",
      min_attendance_pct: 75,
      late_counts_as_attended: false,
    };
    const response = await fetch(`${apiBaseUrl}/offerings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(201);
    const created: { id: string } = await response.json();

    const results = await fetch(
      `${apiBaseUrl}/offerings/search?q=CPE%20305&limit=50&offset=0`,
    );
    expect(results.status).toBe(200);
    const search: SearchOfferingsResponse = await results.json();
    expect(search.items).toContainEqual(
      expect.objectContaining({
        offering_id: created.id,
        course_code: "CPE 305",
        course_title: "Computer Architecture",
        level: 400,
        registration_mode: "approval",
        semester: "Semester 1",
      }),
    );
  });

  it("adds a mock lecturer while retaining the existing offering assignments", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    startMockSession("department-admin");
    const offeringId = "4c39d74e-7b7c-4cb0-8bd5-c8274905e3ce";
    const response = await fetch(
      `${apiBaseUrl}/offerings/${offeringId}/lecturers`,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject([
      {
        id: "20000000-0000-4000-8000-000000000002",
        display_name: "Dr. Ngozi Eze",
      },
    ]);

    const update = await fetch(
      `${apiBaseUrl}/offerings/${offeringId}/lecturers`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecturer_ids: [
            "20000000-0000-4000-8000-000000000002",
            "20000000-0000-4000-8000-000000000010",
          ],
        }),
      },
    );
    expect(update.status).toBe(200);
    await expect(update.json()).resolves.toEqual({
      lecturer_ids: [
        "20000000-0000-4000-8000-000000000002",
        "20000000-0000-4000-8000-000000000010",
      ],
    });
    const refreshed = await fetch(
      `${apiBaseUrl}/offerings/${offeringId}/lecturers`,
    );
    await expect(refreshed.json()).resolves.toMatchObject([
      { id: "20000000-0000-4000-8000-000000000002" },
      { id: "20000000-0000-4000-8000-000000000010" },
    ]);
  });
});
