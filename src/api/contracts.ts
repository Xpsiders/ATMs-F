import type { components, operations } from "./schema";

export type SessionCodeResponse =
  operations["getSessionCode"]["responses"][200]["content"]["application/json"];
export type LiveClassesResponse =
  operations["getMyLiveClasses"]["responses"][200]["content"]["application/json"];
export type LiveClass = LiveClassesResponse["items"][number];
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
