import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AcademicSessionsResponse,
  CreateAcademicSessionResponse,
  VenueListResponse,
} from "@/api/contracts";
import { resetDemoPasswordState } from "@/mocks/auth";
import { resetDemoData } from "@/mocks/store";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

afterEach(() => {
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
          session.id === createdSession.id &&
          session.name === "2026/2027",
      ),
    ).toBe(true);
  });
});
