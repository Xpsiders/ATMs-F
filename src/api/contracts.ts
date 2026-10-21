import type { components, operations } from "./schema";

export type SessionCodeResponse =
  operations["getSessionCode"]["responses"][200]["content"]["application/json"];
export type LiveClassesResponse =
  operations["getMyLiveClasses"]["responses"][200]["content"]["application/json"];
export type LiveClass = LiveClassesResponse["items"][number];
export type StudentCoursesResponse =
  operations["getMyCourses"]["responses"][200]["content"]["application/json"];
export type StudentCourse = StudentCoursesResponse["items"][number];
export type StudentTimetableResponse =
  operations["getMyTimetable"]["responses"][200]["content"]["application/json"];
export type TimetableEntry = StudentTimetableResponse["items"][number];
export type StudentAttendanceResponse =
  operations["getMyAttendance"]["responses"][200]["content"]["application/json"];
export type StudentAttendanceEntry =
  StudentAttendanceResponse["items"][number];
export type PendingRegistrationsResponse =
  operations["getMyPendingRegistrations"]["responses"][200]["content"]["application/json"];
export type PendingRegistration =
  PendingRegistrationsResponse["items"][number];
export type SearchOfferingsResponse =
  operations["searchOfferings"]["responses"][200]["content"]["application/json"];
export type SearchOffering = SearchOfferingsResponse["items"][number];
export type SearchOfferingsQuery =
  operations["searchOfferings"]["parameters"]["query"];
export type DepartmentCatalogueResponse =
  operations["listDepartments"]["responses"][200]["content"]["application/json"];
export type RegistrationResponse =
  operations["registerForOffering"]["responses"][201]["content"]["application/json"];
export type VenueListResponse =
  operations["listVenues"]["responses"][200]["content"]["application/json"];
export type Venue = VenueListResponse["items"][number];
export type OfferingsResponse =
  operations["getMyOfferings"]["responses"][200]["content"]["application/json"];
export type StartSessionRequest =
  operations["startSession"]["requestBody"]["content"]["application/json"];
export type StartSessionResponse =
  operations["startSession"]["responses"][201]["content"]["application/json"];
export type EndSessionResponse =
  operations["endSession"]["responses"][200]["content"]["application/json"];
export type LoginResponse =
  operations["login"]["responses"][200]["content"]["application/json"];
export type CurrentUser =
  operations["getCurrentUser"]["responses"][200]["content"]["application/json"];
export type CheckInRequest =
  operations["createWebCheckin"]["requestBody"]["content"]["application/json"];
export type CheckInResponse =
  operations["createWebCheckin"]["responses"][201]["content"]["application/json"];
export type RosterPage =
  operations["getSessionRosterSheet"]["responses"][200]["content"]["application/json"];
export type RosterSheetRow = components["schemas"]["RosterPage"]["items"][number];
export type SessionPatchResponse =
  operations["convertSessionToFixedCode"]["responses"][200]["content"]["application/json"];
export type AttendanceOverrideRequest =
  components["schemas"]["BulkOverrideRequest"];
export type BulkOverrideResponse =
  operations["createBulkAttendanceOverrides"]["responses"][200]["content"]["application/json"];
export type SignupClaimRequest =
  operations["startStudentClaim"]["requestBody"]["content"]["application/json"];
export type SignupVerifyRequest =
  operations["verifyStudentEmail"]["requestBody"]["content"]["application/json"];
export type ChangePasswordRequest =
  operations["changePassword"]["requestBody"]["content"]["application/json"];
export type SessionPatchRequest =
  operations["convertSessionToFixedCode"]["requestBody"]["content"]["application/json"];
export type LoginRequest =
  operations["login"]["requestBody"]["content"]["application/json"];
