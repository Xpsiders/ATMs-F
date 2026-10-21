import { http, HttpResponse } from "msw";
import type {
  CheckInRequest,
  CurrentUser,
  StartSessionRequest,
} from "@/api/contracts";
import { getMockSession } from "@/mocks/auth";
import {
  createDemoSession,
  endDemoSession,
  getDemoSession,
  getDemoSessionCode,
  getDemoState,
  listDemoLiveClasses,
  listDemoOfferings,
  listDemoVenues,
  recordDemoCheckIn,
  setDemoSessionFixedCode,
} from "@/mocks/store";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { error: { code, message, details: {} } },
    { status },
  );
}

export const handlers = [
  http.get(`${apiBaseUrl}/me`, () => {
    const account = getMockSession();
    if (!account) return apiError(401, "unauthorized", "Sign in is required.");
    const roleByDemoRole = {
      student: "student",
      lecturer: "lecturer",
      "department-admin": "department_admin",
      "institution-admin": "institution_admin",
    } as const;
    const scopeType =
      account.role === "institution-admin" ? "institution" : "department";
    const departmentId =
      account.role === "student"
        ? "10000000-0000-4000-8000-000000000003"
        : "10000000-0000-4000-8000-000000000004";
    const userIdByRole = {
      student: "20000000-0000-4000-8000-000000000001",
      lecturer: "20000000-0000-4000-8000-000000000002",
      "department-admin": "20000000-0000-4000-8000-000000000003",
      "institution-admin": "20000000-0000-4000-8000-000000000004",
    } as const;
    const profile: CurrentUser = {
      id: userIdByRole[account.role],
      name: account.name,
      email: account.email,
      status: "active",
      must_change_password: false,
      roles: [
        {
          role: roleByDemoRole[account.role],
          scope_type: scopeType,
          scope_id: scopeType === "institution" ? null : departmentId,
          ...(scopeType === "department" ? { department_id: departmentId } : {}),
          ...(account.role === "student" ? { level: 300 } : {}),
        },
      ],
    };
    return HttpResponse.json(profile);
  }),
  http.get(`${apiBaseUrl}/me/offerings`, () =>
    HttpResponse.json(listDemoOfferings()),
  ),
  http.get(`${apiBaseUrl}/venues`, () =>
    HttpResponse.json(listDemoVenues()),
  ),
  http.get(`${apiBaseUrl}/me/live-classes`, () => {
    const account = getMockSession();
    const student = account
      ? getDemoState().students.find(
          (candidate) => candidate.name === account.name,
        )
      : undefined;
    return HttpResponse.json(listDemoLiveClasses(student?.id));
  }),
  http.post(`${apiBaseUrl}/sessions`, async ({ request }) => {
    const payload = (await request.json()) as StartSessionRequest;
    const response = createDemoSession(payload);
    if (!response)
      return apiError(404, "resource_not_found", "Offering or venue was not found.");
    return HttpResponse.json(response, { status: 201 });
  }),
  http.get(`${apiBaseUrl}/sessions/:id/code`, ({ params }) => {
    const response = getDemoSessionCode(String(params.id));
    if (!response)
      return apiError(409, "session_closed", "The session is not live.");
    return HttpResponse.json(response);
  }),
  http.patch(`${apiBaseUrl}/sessions/:id`, async ({ params, request }) => {
    const sessionId = String(params.id);
    const session = getDemoSession(sessionId);
    if (!session)
      return apiError(404, "session_not_found", "Session was not found.");
    const payload = (await request.json()) as { rotating: false };
    if (payload.rotating !== false)
      return apiError(400, "invalid_request", "The session can only be converted to fixed code.");
    setDemoSessionFixedCode(sessionId, session.code);
    const response = getDemoSessionCode(sessionId);
    return response
      ? HttpResponse.json(response)
      : apiError(409, "session_closed", "The session is not live.");
  }),
  http.post(`${apiBaseUrl}/sessions/:id/end`, ({ params }) => {
    const session = endDemoSession(String(params.id));
    return session
      ? HttpResponse.json(session)
      : apiError(404, "session_not_found", "Session was not found.");
  }),
  http.post(`${apiBaseUrl}/checkins`, async ({ request }) => {
    const payload = (await request.json()) as CheckInRequest;
    const session = getDemoSession(payload.session_id);
    if (!session || session.state !== "live")
      return apiError(409, "session_closed", "The session is not live.");
    if (payload.code !== session.code)
      return apiError(400, "wrong_code", "The code did not match.");
    const account = getMockSession();
    const student = account
      ? getDemoState().students.find(
          (candidate) => candidate.name === account.name,
        )
      : undefined;
    if (!student)
      return apiError(403, "not_on_roster", "Student is not on the class roster.");
    recordDemoCheckIn(student.id, session.id, "verified");
    return HttpResponse.json(
      {
        session_id: session.id,
        status: "present",
        on_roster: true,
        accuracy_poor: false,
        distance_meters: 24,
      },
      { status: 201 },
    );
  }),
];
