import { http, HttpResponse } from "msw";
import type {
  CaptureVenueLocationRequest,
  CheckInRequest,
  CurrentUser,
  CreateAcademicSessionRequest,
  CreateCourseRequest,
  CreateOfferingRequest,
  CreateRoleAssignmentRequest,
  CreateSemesterRequest,
  CreateVenueRequest,
  DirectoryUsersQuery,
  EnqueueEnrolmentRequest,
  ProvisionDeviceRequest,
  RequestPasswordReset,
  ResetPasswordRequest,
  ReviewSignupRequest,
  ReviewTeachingRequestRequest,
  SignupRequestsResponse,
  StaffImportPreview,
  SearchOfferingsQuery,
  SessionLocationRequest,
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
  bindDemoDevice,
  captureDemoVenueLocation,
  createDemoAcademicSession,
  createDemoCourse,
  deleteDemoCourse,
  deleteDemoOffering,
  listDemoPublicDepartments,
  createDemoOffering,
  createDemoSemester,
  createDemoVenue,
  createDemoSession,
  deactivateDemoVenue,
  deleteDemoAcademicSession,
  deleteDemoSemester,
  endDemoSession,
  enqueueDemoEnrolment,
  getDemoVenueScannerStatus,
  listDemoDevices,
  provisionDemoDevice,
  regenerateDemoPairingCode,
  revokeDemoDevice,
  rotateDemoDeviceKey,
  updateDemoSessionLocation,
  getDemoDeviceOwner,
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
  listDemoTeachingRequests,
  listDemoVenues,
  recordDemoCheckIn,
  reviewDemoTeachingRequest,
  registerDemoOffering,
  searchDemoDirectoryUsers,
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

const DEVICE_SCOPE_ROLES = [
  "department-admin",
  "faculty-admin",
  "institution-admin",
  "lecturer",
];

function denyDeviceScope() {
  const account = getMockSession();
  if (!account || !DEVICE_SCOPE_ROLES.includes(account.role))
    return apiError(
      403,
      "device_scope_denied",
      "This account cannot manage scanners in this scope.",
    );
  return null;
}

const DEMO_SIGNUP_REQUESTS: NonNullable<SignupRequestsResponse["items"]> = [];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handlers = [
  http.get(`${apiBaseUrl}/public/departments`, ({ request }) => {
    const institutionId = new URL(request.url).searchParams.get(
      "institution_id",
    );
    if (!institutionId || !UUID_RE.test(institutionId))
      return apiError(
        400,
        "invalid_request",
        "A valid institution_id is required.",
      );
    return HttpResponse.json(listDemoPublicDepartments());
  }),
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
  http.get(`${apiBaseUrl}/users`, ({ request }) => {
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
        "This account cannot read the user directory.",
      );
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const query: DirectoryUsersQuery = {
      q: url.searchParams.get("q") ?? undefined,
      role: (role as NonNullable<DirectoryUsersQuery>["role"]) ?? undefined,
      department_id: url.searchParams.get("department_id") ?? undefined,
      limit: url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
      offset: url.searchParams.has("offset")
        ? Number(url.searchParams.get("offset"))
        : undefined,
    };
    return HttpResponse.json(searchDemoDirectoryUsers(query));
  }),
  http.get(`${apiBaseUrl}/teaching-requests`, () => {
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
        "This account cannot review teaching requests.",
      );
    return HttpResponse.json(listDemoTeachingRequests());
  }),
  http.patch(
    `${apiBaseUrl}/teaching-requests/:id`,
    async ({ params, request }) => {
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
          "This account cannot review teaching requests.",
        );
      const payload = (await request.json()) as ReviewTeachingRequestRequest;
      const result = reviewDemoTeachingRequest(String(params.id), payload.status);
      return result
        ? HttpResponse.json(result)
        : apiError(404, "resource_not_found", "Teaching request was not found.");
    },
  ),
  http.get(`${apiBaseUrl}/devices`, ({ request }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    const url = new URL(request.url);
    const limit = url.searchParams.has("limit")
      ? Number(url.searchParams.get("limit"))
      : 50;
    const offset = url.searchParams.has("offset")
      ? Number(url.searchParams.get("offset"))
      : 0;
    return HttpResponse.json(listDemoDevices(limit, offset));
  }),
  http.get(`${apiBaseUrl}/venues/:id/scanner-status`, ({ params }) => {
    const account = getMockSession();
    if (!account || !DEVICE_SCOPE_ROLES.includes(account.role))
      return apiError(
        403,
        "access_denied",
        "This account cannot view scanner status in this venue scope.",
      );
    const status = getDemoVenueScannerStatus(String(params.id));
    return status
      ? HttpResponse.json(status)
      : apiError(404, "venue_not_found", "Venue was not found.");
  }),
  http.post(`${apiBaseUrl}/devices`, async ({ request }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    const payload = (await request.json()) as ProvisionDeviceRequest;
    if (!payload.venue_id || !payload.name?.trim())
      return apiError(
        400,
        "invalid_request",
        "A venue and scanner name are required.",
      );
    return HttpResponse.json(provisionDemoDevice(payload), { status: 201 });
  }),
  http.post(`${apiBaseUrl}/devices/:id/pairing-code`, ({ params }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    const result = regenerateDemoPairingCode(String(params.id));
    return result
      ? HttpResponse.json(result, { status: 201 })
      : apiError(404, "device_not_found", "Scanner was not found.");
  }),
  http.post(`${apiBaseUrl}/devices/:id/rotate-key`, ({ params }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    const result = rotateDemoDeviceKey(String(params.id));
    return result
      ? HttpResponse.json(result, { status: 201 })
      : apiError(404, "device_not_found", "Scanner was not found.");
  }),
  http.delete(`${apiBaseUrl}/devices/:id`, ({ params }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    return revokeDemoDevice(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "device_not_found", "Scanner was not found.");
  }),
  http.post(`${apiBaseUrl}/devices/:id/enrolments`, async ({ params, request }) => {
    const denied = denyDeviceScope();
    if (denied) return denied;
    const payload = (await request.json()) as EnqueueEnrolmentRequest;
    if (!payload.student_record_id)
      return apiError(400, "invalid_request", "A student is required.");
    const result = enqueueDemoEnrolment(
      String(params.id),
      payload.student_record_id,
    );
    if (result === "device_not_found")
      return apiError(404, "device_not_found", "Scanner was not found.");
    if (result === "student_not_found")
      return apiError(404, "student_not_found", "Student record was not found.");
    return HttpResponse.json(result, { status: 201 });
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
    if (!account)
      return apiError(401, "unauthorized", "Sign in is required.");
    // Lecturers see the offerings they teach; everyone else (e.g. students
    // browsing classes) gets the catalogue offerings visible in their scope.
    return HttpResponse.json(
      listDemoOfferings(account.role === "lecturer" ? account.name : undefined),
    );
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
  http.delete(`${apiBaseUrl}/courses/:id`, ({ params }) => {
    const account = getMockSession();
    if (
      !account ||
      !["department-admin", "faculty-admin", "institution-admin"].includes(
        account.role,
      )
    )
      return apiError(403, "forbidden", "This account cannot manage this course.");
    const result = deleteDemoCourse(String(params.id));
    if (result === "not_found")
      return apiError(404, "course_not_found", "Course was not found.");
    if (result === "has_offerings")
      return apiError(
        409,
        "course_has_offerings",
        "This course still has offerings and cannot be deleted.",
      );
    return new HttpResponse(null, { status: 204 });
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
  http.delete(`${apiBaseUrl}/offerings/:id`, ({ params }) => {
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
        "This account cannot manage this offering.",
      );
    return deleteDemoOffering(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "resource_not_found", "Offering was not found.");
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
  http.post(`${apiBaseUrl}/venues/:id/location`, async ({ params, request }) => {
    const payload = (await request.json()) as CaptureVenueLocationRequest;
    const result = captureDemoVenueLocation(String(params.id), payload);
    if (result === null)
      return apiError(404, "venue_not_found", "Venue was not found.");
    if (result === "too_inaccurate")
      return apiError(
        400,
        "location_too_inaccurate",
        "The captured fix is too imprecise to store.",
      );
    return HttpResponse.json(result);
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
  http.post(`${apiBaseUrl}/sessions/:id/location`, async ({ params, request }) => {
    const payload = (await request.json()) as SessionLocationRequest;
    const result = updateDemoSessionLocation(String(params.id), payload);
    if (result === null)
      return apiError(404, "session_not_found", "Session was not found.");
    if (result === "closed")
      return apiError(409, "session_closed", "The session is already closed.");
    return HttpResponse.json(result);
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
    if (
      typeof payload.device_hash !== "string" ||
      payload.device_hash.length < 8
    )
      return apiError(
        400,
        "invalid_request",
        "A device_hash is required for every check-in.",
      );
    if (
      !Number.isFinite(payload.lat) ||
      payload.lat < -90 ||
      payload.lat > 90 ||
      !Number.isFinite(payload.lng) ||
      payload.lng < -180 ||
      payload.lng > 180 ||
      !Number.isFinite(payload.accuracy) ||
      payload.accuracy < 0
    )
      return apiError(
        400,
        "location_required",
        "A valid location is required for check-in.",
      );
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
    const deviceOwner = getDemoDeviceOwner(session.id, payload.device_hash);
    if (deviceOwner && deviceOwner !== student.id)
      return apiError(
        409,
        "device_already_used",
        "This device has already checked in another student for this session.",
      );
    // A valid location is required, but distance never blocks the check-in.
    const comparable =
      typeof session.latitude === "number" &&
      typeof session.longitude === "number" &&
      typeof payload.lat === "number" &&
      typeof payload.lng === "number";
    const distanceMeters = comparable ? 24 : null;
    const accuracy = payload.accuracy ?? 0;
    bindDemoDevice(session.id, payload.device_hash, student.id);
    recordDemoCheckIn(student.id, session.id, "verified");
    return HttpResponse.json(
      {
        session_id: session.id,
        status: "present",
        on_roster: true,
        accuracy_poor: accuracy > 100,
        distance_meters: distanceMeters,
        location_unverified: false,
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
