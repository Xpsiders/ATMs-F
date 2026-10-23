import { http, HttpResponse } from "msw";
import type {
  CheckInRequest,
  CurrentUser,
  CreateAcademicSessionRequest,
  CreateCourseRequest,
  CreateOfferingRequest,
  CreateRoleAssignmentRequest,
  CreateSemesterRequest,
  CreateVenueRequest,
  RequestPasswordReset,
  ResetPasswordRequest,
  ReviewSignupRequest,
  SignupRequestsResponse,
  StaffImportPreview,
  SearchOfferingsQuery,
  SetOfferingLecturersRequest,
  StartSessionRequest,
  UpdateAcademicSessionRequest,
  UpdateSemesterRequest,
  UpdateVenueRequest,
} from "@/api/contracts";
import {
  getMockSession,
  requestDemoPasswordReset,
  resetDemoPassword,
} from "@/mocks/auth";
import {
  createDemoAcademicSession,
  createDemoCourse,
  createDemoOffering,
  createDemoSemester,
  createDemoVenue,
  createDemoSession,
  deactivateDemoVenue,
  deleteDemoAcademicSession,
  deleteDemoSemester,
  endDemoSession,
  getDemoSession,
  getDemoSessionCode,
  getDemoState,
  listDemoAcademicSessions,
  listDemoCourses,
  listDemoDepartments,
  listDemoLiveClasses,
  listDemoPendingRegistrations,
  listDemoOfferings,
  listDemoOfferingLecturers,
  listDemoSemesters,
  listDemoStudentAttendance,
  listDemoStudentCourses,
  listDemoStudentTimetable,
  listDemoVenues,
  recordDemoCheckIn,
  registerDemoOffering,
  searchDemoOfferings,
  setDemoSessionFixedCode,
  setDemoOfferingLecturers,
  updateDemoAcademicSession,
  updateDemoSemester,
  updateDemoVenue,
} from "@/mocks/store";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { error: { code, message, details: {} } },
    { status },
  );
}

const DEMO_SIGNUP_REQUESTS: NonNullable<SignupRequestsResponse["items"]> = [];

export const handlers = [
  http.post(`${apiBaseUrl}/auth/password/forgot`, async ({ request }) => {
    const payload = (await request.json()) as RequestPasswordReset;
    requestDemoPasswordReset(payload.email);
    return HttpResponse.json({ status: "request_received" }, { status: 202 });
  }),
  http.post(`${apiBaseUrl}/auth/password/reset`, async ({ request }) => {
    const payload = (await request.json()) as ResetPasswordRequest;
    if (!resetDemoPassword(payload.email, payload.code, payload.new_password))
      return apiError(
        400,
        "invalid_reset_code",
        "The reset code is invalid or expired.",
      );
    return new HttpResponse(null, { status: 200 });
  }),
  http.post(`${apiBaseUrl}/imports/staff/preview`, async ({ request }) =>
    HttpResponse.json(parseStaffCsv(await request.text())),
  ),
  http.post(`${apiBaseUrl}/imports/staff`, async ({ request }) => {
    const preview = parseStaffCsv(await request.text());
    return preview.errors.length
      ? HttpResponse.json(preview, { status: 422 })
      : HttpResponse.json(preview, { status: 201 });
  }),
  http.get(`${apiBaseUrl}/signup-requests`, () =>
    HttpResponse.json({ items: DEMO_SIGNUP_REQUESTS }),
  ),
  http.post(`${apiBaseUrl}/signup-requests/:id/review`, async ({ request }) => {
    const payload = (await request.json()) as ReviewSignupRequest;
    if (
      payload.status === "approved" &&
      (!payload.department_id ||
        !payload.level ||
        !payload.programme_id ||
        !payload.display_name)
    )
      return apiError(
        400,
        "invalid_request",
        "Student details are required for approval.",
      );
    return new HttpResponse(null, { status: 200 });
  }),
  http.post(`${apiBaseUrl}/role-assignments`, async ({ request }) => {
    const payload = (await request.json()) as CreateRoleAssignmentRequest;
    if (
      (payload.scope_type === "department" && !payload.department_id) ||
      (payload.scope_type === "faculty" && !payload.faculty_id)
    )
      return apiError(
        400,
        "invalid_request",
        "The selected scope identifier is required.",
      );
    return new HttpResponse(null, { status: 201 });
  }),
  http.get(`${apiBaseUrl}/academic-sessions`, () =>
    HttpResponse.json(listDemoAcademicSessions()),
  ),
  http.post(`${apiBaseUrl}/academic-sessions`, async ({ request }) => {
    const payload = (await request.json()) as CreateAcademicSessionRequest;
    return HttpResponse.json(createDemoAcademicSession(payload), {
      status: 201,
    });
  }),
  http.patch(
    `${apiBaseUrl}/academic-sessions/:id`,
    async ({ params, request }) => {
      const payload = (await request.json()) as UpdateAcademicSessionRequest;
      const item = updateDemoAcademicSession(String(params.id), payload);
      return item
        ? HttpResponse.json(item)
        : apiError(
            404,
            "resource_not_found",
            "Academic session was not found.",
          );
    },
  ),
  http.delete(`${apiBaseUrl}/academic-sessions/:id`, ({ params }) =>
    deleteDemoAcademicSession(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "resource_not_found", "Academic session was not found."),
  ),
  http.get(`${apiBaseUrl}/semesters`, () =>
    HttpResponse.json(listDemoSemesters()),
  ),
  http.post(`${apiBaseUrl}/semesters`, async ({ request }) => {
    const payload = (await request.json()) as CreateSemesterRequest;
    return HttpResponse.json(createDemoSemester(payload), { status: 201 });
  }),
  http.patch(`${apiBaseUrl}/semesters/:id`, async ({ params, request }) => {
    const payload = (await request.json()) as UpdateSemesterRequest;
    const item = updateDemoSemester(String(params.id), payload);
    return item
      ? HttpResponse.json(item)
      : apiError(404, "resource_not_found", "Semester was not found.");
  }),
  http.delete(`${apiBaseUrl}/semesters/:id`, ({ params }) =>
    deleteDemoSemester(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "resource_not_found", "Semester was not found."),
  ),
  http.get(`${apiBaseUrl}/me`, () => {
    const account = getMockSession();
    if (!account) return apiError(401, "unauthorized", "Sign in is required.");
    const roleByDemoRole = {
      student: "student",
      lecturer: "lecturer",
      "department-admin": "department_admin",
      "faculty-admin": "faculty_admin",
      "institution-admin": "institution_admin",
    } as const;
    const scopeType =
      account.role === "institution-admin" ? "institution" : "department";
    const roleScopeType =
      account.role === "faculty-admin" ? "faculty" : scopeType;
    const departmentId =
      account.role === "student"
        ? "10000000-0000-4000-8000-000000000003"
        : "10000000-0000-4000-8000-000000000004";
    const userIdByRole = {
      student: "20000000-0000-4000-8000-000000000001",
      lecturer: "20000000-0000-4000-8000-000000000002",
      "department-admin": "20000000-0000-4000-8000-000000000003",
      "faculty-admin": "20000000-0000-4000-8000-000000000005",
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
          scope_type: roleScopeType,
          scope_id:
            roleScopeType === "institution"
              ? null
              : roleScopeType === "faculty"
                ? "20000000-0000-4000-8000-000000000006"
                : departmentId,
          ...(roleScopeType === "department"
            ? { department_id: departmentId }
            : {}),
          ...(account.role === "student" ? { level: 300 } : {}),
        },
      ],
    };
    return HttpResponse.json(profile);
  }),
  http.get(`${apiBaseUrl}/me/offerings`, () => {
    const account = getMockSession();
    if (!account || account.role !== "lecturer")
      return apiError(403, "not_a_lecturer", "This endpoint is for lecturers.");
    return HttpResponse.json(listDemoOfferings(account.name));
  }),
  http.get(`${apiBaseUrl}/departments`, () =>
    getMockSession()
      ? HttpResponse.json(listDemoDepartments())
      : apiError(401, "unauthorized", "Sign in is required."),
  ),
  http.post(`${apiBaseUrl}/courses`, async ({ request }) => {
    const account = getMockSession();
    if (!account)
      return apiError(403, "forbidden", "This account cannot create courses.");
    const payload = (await request.json()) as CreateCourseRequest;
    const departmentInScope =
      account.role === "institution-admin" ||
      (account.role === "department-admin" &&
        payload.department_id === "10000000-0000-4000-8000-000000000004") ||
      (account.role === "faculty-admin" &&
        listDemoDepartments().items.some(
          (department) => department.id === payload.department_id,
        ));
    if (!departmentInScope)
      return apiError(
        403,
        "forbidden",
        "This account cannot create courses in that department.",
      );
    return HttpResponse.json(createDemoCourse(payload), { status: 201 });
  }),
  http.get(`${apiBaseUrl}/courses`, () => {
    const account = getMockSession();
    return account &&
      ["department-admin", "faculty-admin", "institution-admin"].includes(
        account.role,
      )
      ? HttpResponse.json(listDemoCourses())
      : apiError(403, "forbidden", "This account cannot list courses.");
  }),
  http.post(`${apiBaseUrl}/offerings`, async ({ request }) => {
    const account = getMockSession();
    if (
      !account ||
      !["department-admin", "faculty-admin", "institution-admin"].includes(
        account.role,
      )
    )
      return apiError(
        403,
        "forbidden",
        "This account cannot create offerings.",
      );
    const payload = (await request.json()) as CreateOfferingRequest;
    const offering = createDemoOffering(payload);
    return offering
      ? HttpResponse.json(offering, { status: 201 })
      : apiError(
          404,
          "resource_not_found",
          "The selected course or semester was not found.",
        );
  }),
  http.get(`${apiBaseUrl}/offerings/:id/lecturers`, ({ params }) => {
    const account = getMockSession();
    if (
      !account ||
      !["department-admin", "faculty-admin", "institution-admin"].includes(
        account.role,
      )
    )
      return apiError(403, "forbidden", "This account cannot manage offering lecturers.");
    return HttpResponse.json(
      listDemoOfferingLecturers(String(params.id)),
    );
  }),
  http.put(
    `${apiBaseUrl}/offerings/:id/lecturers`,
    async ({ params, request }) => {
      const account = getMockSession();
      if (
        !account ||
        ![
          "department-admin",
          "faculty-admin",
          "institution-admin",
        ].includes(account.role)
      )
        return apiError(
          403,
          "forbidden",
          "This account cannot manage offering lecturers.",
        );
      const payload = (await request.json()) as SetOfferingLecturersRequest;
      const result = setDemoOfferingLecturers(
        String(params.id),
        payload.lecturer_ids,
      );
      return result
        ? HttpResponse.json(result)
        : apiError(404, "resource_not_found", "Offering was not found.");
    },
  ),
  http.get(`${apiBaseUrl}/me/courses`, () =>
    getMockSession()?.role === "student"
      ? HttpResponse.json(listDemoStudentCourses())
      : apiError(403, "not_a_student", "This endpoint is for students."),
  ),
  http.get(`${apiBaseUrl}/me/timetable`, () =>
    getMockSession()?.role === "student"
      ? HttpResponse.json(listDemoStudentTimetable())
      : apiError(403, "not_a_student", "This endpoint is for students."),
  ),
  http.get(`${apiBaseUrl}/me/attendance`, ({ request }) => {
    const account = getMockSession();
    if (!account || account.role !== "student")
      return apiError(403, "not_a_student", "This endpoint is for students.");
    const offeringId = new URL(request.url).searchParams.get("offering_id");
    if (!offeringId)
      return apiError(400, "invalid_request", "offering_id is required.");
    const student = getDemoState().students.find(
      (candidate) => candidate.name === account.name,
    );
    return HttpResponse.json(
      listDemoStudentAttendance(offeringId, student?.id),
    );
  }),
  http.get(`${apiBaseUrl}/me/registrations`, () =>
    getMockSession()?.role === "student"
      ? HttpResponse.json(listDemoPendingRegistrations())
      : apiError(403, "not_a_student", "This endpoint is for students."),
  ),
  http.get(`${apiBaseUrl}/offerings/search`, ({ request }) => {
    const url = new URL(request.url);
    const level = url.searchParams.get("level");
    const query: SearchOfferingsQuery = {
      q: url.searchParams.get("q") ?? "",
      ...(url.searchParams.get("department_id")
        ? { department_id: url.searchParams.get("department_id")! }
        : {}),
      ...(level ? { level: Number(level) } : {}),
      ...(readSearchKind(url.searchParams.get("kind"))
        ? { kind: readSearchKind(url.searchParams.get("kind")) }
        : {}),
      ...(url.searchParams.get("limit")
        ? { limit: Number(url.searchParams.get("limit")) }
        : {}),
      ...(url.searchParams.get("offset")
        ? { offset: Number(url.searchParams.get("offset")) }
        : {}),
    };
    const role = getMockSession()?.role;
    return role === "student" ||
      role === "department-admin" ||
      role === "faculty-admin" ||
      role === "institution-admin"
      ? HttpResponse.json(searchDemoOfferings(query))
      : apiError(
          403,
          "forbidden",
          "This endpoint is not available to this account.",
        );
  }),
  http.post(`${apiBaseUrl}/offerings/:id/registrations`, ({ params }) => {
    if (getMockSession()?.role !== "student")
      return apiError(403, "not_a_student", "This endpoint is for students.");
    const registration = registerDemoOffering(String(params.id));
    return registration
      ? HttpResponse.json(registration, { status: 201 })
      : apiError(409, "registration_closed", "Registration is closed.");
  }),
  http.get(`${apiBaseUrl}/venues`, () => HttpResponse.json(listDemoVenues())),
  http.post(`${apiBaseUrl}/venues`, async ({ request }) => {
    const payload = (await request.json()) as CreateVenueRequest;
    createDemoVenue(payload);
    return HttpResponse.json({}, { status: 201 });
  }),
  http.patch(`${apiBaseUrl}/venues/:id`, async ({ params, request }) => {
    const payload = (await request.json()) as UpdateVenueRequest;
    const item = updateDemoVenue(String(params.id), payload);
    if (!item)
      return apiError(404, "resource_not_found", "Venue was not found.");
    return HttpResponse.json({});
  }),
  http.delete(`${apiBaseUrl}/venues/:id`, ({ params }) =>
    deactivateDemoVenue(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "resource_not_found", "Venue was not found."),
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
      return apiError(
        404,
        "resource_not_found",
        "Offering or venue was not found.",
      );
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
      return apiError(
        400,
        "invalid_request",
        "The session can only be converted to fixed code.",
      );
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
      return apiError(
        403,
        "not_on_roster",
        "Student is not on the class roster.",
      );
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

function readSearchKind(
  value: string | null,
): SearchOfferingsQuery["kind"] | undefined {
  return value === "departmental" || value === "general" ? value : undefined;
}

function parseStaffCsv(csv: string): StaffImportPreview {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  const expectedHeaders = [
    "staff_no",
    "email",
    "display_name",
    "department_id",
  ];
  const headers = lines[0] ? parseCsvLine(lines[0]) : [];
  if (
    expectedHeaders.some((header, index) => headers[index] !== header) ||
    headers.length !== expectedHeaders.length
  )
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `CSV headers must be ${expectedHeaders.join(", ")}.`,
        },
      ],
    };

  const rows: StaffImportPreview["rows"] = [];
  const errors: StaffImportPreview["errors"] = [];
  lines.slice(1).forEach((line, index) => {
    const values = parseCsvLine(line);
    const [staff_no, email, display_name, department_id] = values;
    if (values.length !== expectedHeaders.length) {
      errors.push({ line: index + 2, message: "Expected four CSV columns." });
    } else if (!staff_no || !email || !display_name || !department_id) {
      errors.push({ line: index + 2, message: "All fields are required." });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        line: index + 2,
        column: "email",
        message: "Email is invalid.",
      });
    } else if (!/^[0-9a-f-]{36}$/i.test(department_id)) {
      errors.push({
        line: index + 2,
        column: "department_id",
        message: "Department ID must be a UUID.",
      });
    } else {
      rows.push({
        line: index + 2,
        staff_no,
        email,
        display_name,
        department_id,
      });
    }
  });
  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}
