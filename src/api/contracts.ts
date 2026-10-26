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
export type StudentAttendanceEntry = StudentAttendanceResponse["items"][number];
export type PendingRegistrationsResponse =
  operations["getMyPendingRegistrations"]["responses"][200]["content"]["application/json"];
export type PendingRegistration = PendingRegistrationsResponse["items"][number];
export type SearchOfferingsResponse =
  operations["searchOfferings"]["responses"][200]["content"]["application/json"];
export type SearchOffering = SearchOfferingsResponse["items"][number];
export type SearchOfferingsQuery =
  operations["searchOfferings"]["parameters"]["query"];
export type OfferingLecturersResponse =
  operations["listOfferingLecturers"]["responses"][200]["content"]["application/json"];
export type SetOfferingLecturersRequest =
  operations["setOfferingLecturers"]["requestBody"]["content"]["application/json"];
export type SetOfferingLecturersResponse =
  operations["setOfferingLecturers"]["responses"][200]["content"]["application/json"];
export type DepartmentCatalogueResponse =
  operations["listDepartments"]["responses"][200]["content"]["application/json"];
export type PublicDepartmentsResponse =
  operations["listPublicDepartments"]["responses"][200]["content"]["application/json"];
export type PublicDepartment = PublicDepartmentsResponse["items"][number];
export type CatalogueListResponse =
  operations["listCourses"]["responses"][200]["content"]["application/json"];
export type CatalogueItem = components["schemas"]["CatalogueItem"];
export type CreateCourseRequest =
  operations["createCourse"]["requestBody"]["content"]["application/json"];
export type CreateCourseResponse =
  operations["createCourse"]["responses"][201]["content"]["application/json"];
export type CreateOfferingRequest =
  operations["createOffering"]["requestBody"]["content"]["application/json"];
export type CreateOfferingResponse =
  | operations["createOffering"]["responses"][201]["content"]["application/json"]
  | operations["createOffering"]["responses"][202]["content"]["application/json"];
export type DirectoryUsersResponse =
  operations["listDirectoryUsers"]["responses"][200]["content"]["application/json"];
export type DirectoryUser = DirectoryUsersResponse["items"][number];
export type DirectoryUsersQuery =
  operations["listDirectoryUsers"]["parameters"]["query"];
export type DevicesResponse =
  operations["listDevices"]["responses"][200]["content"]["application/json"];
export type DeviceListItem = DevicesResponse["items"][number];
export type ProvisionDeviceRequest =
  operations["provisionDevice"]["requestBody"]["content"]["application/json"];
export type ProvisionedDevice =
  operations["provisionDevice"]["responses"][201]["content"]["application/json"];
export type DevicePairingCode =
  operations["regenerateDevicePairingCode"]["responses"][201]["content"]["application/json"];
export type EnqueueEnrolmentRequest =
  operations["enqueueDeviceEnrolment"]["requestBody"]["content"]["application/json"];
export type EnqueueEnrolmentResponse =
  operations["enqueueDeviceEnrolment"]["responses"][201]["content"]["application/json"];
export type TeachingRequestsResponse =
  operations["listTeachingRequests"]["responses"][200]["content"]["application/json"];
export type TeachingRequest = TeachingRequestsResponse["items"][number];
export type ReviewTeachingRequestRequest =
  operations["reviewTeachingRequest"]["requestBody"]["content"]["application/json"];
export type RegistrationResponse =
  operations["registerForOffering"]["responses"][201]["content"]["application/json"];
export type VenueListResponse =
  operations["listVenues"]["responses"][200]["content"]["application/json"];
export type Venue = VenueListResponse["items"][number];
export type OfferingsResponse =
  operations["getMyOfferings"]["responses"][200]["content"]["application/json"];
export type StaffImportRequest =
  operations["previewStaffImport"]["requestBody"]["content"]["text/csv"];
export type StaffImportPreview =
  operations["previewStaffImport"]["responses"][200]["content"]["application/json"];
export type StaffImportCommitResponse =
  operations["commitStaffImport"]["responses"][201]["content"]["application/json"];
export type SignupRequestsResponse =
  operations["listSignupRequests"]["responses"][200]["content"]["application/json"];
export type ReviewSignupRequest =
  operations["reviewSignupRequest"]["requestBody"]["content"]["application/json"];
export type CreateRoleAssignmentRequest =
  operations["createRoleAssignment"]["requestBody"]["content"]["application/json"];
export type AcademicSessionsResponse =
  operations["listAcademicSessions"]["responses"][200]["content"]["application/json"];
export type CreateAcademicSessionRequest =
  operations["createAcademicSession"]["requestBody"]["content"]["application/json"];
export type UpdateAcademicSessionRequest =
  operations["updateAcademicSession"]["requestBody"]["content"]["application/json"];
export type SemestersResponse =
  operations["listSemesters"]["responses"][200]["content"]["application/json"];
export type CreateSemesterRequest =
  operations["createSemester"]["requestBody"]["content"]["application/json"];
export type UpdateSemesterRequest =
  operations["updateSemester"]["requestBody"]["content"]["application/json"];
export type CreateVenueRequest =
  operations["createVenue"]["requestBody"]["content"]["application/json"];
export type CreateVenueResponse =
  operations["createVenue"]["responses"][201]["content"]["application/json"];
export type UpdateVenueRequest =
  operations["updateVenue"]["requestBody"]["content"]["application/json"];
export type UpdateVenueResponse =
  operations["updateVenue"]["responses"][200]["content"]["application/json"];
export type RequestPasswordReset =
  operations["requestPasswordReset"]["requestBody"]["content"]["application/json"];
export type RequestPasswordResetResponse =
  operations["requestPasswordReset"]["responses"][202]["content"]["application/json"];
export type ResetPasswordRequest =
  operations["resetPassword"]["requestBody"]["content"]["application/json"];
export type CreateAcademicSessionResponse =
  operations["createAcademicSession"]["responses"][201]["content"]["application/json"];
export type UpdateAcademicSessionResponse =
  operations["updateAcademicSession"]["responses"][200]["content"]["application/json"];
export type DeleteAcademicSessionResponse =
  operations["deleteAcademicSession"]["responses"][204];
export type CreateSemesterResponse =
  operations["createSemester"]["responses"][201]["content"]["application/json"];
export type UpdateSemesterResponse =
  operations["updateSemester"]["responses"][200]["content"]["application/json"];
export type DeleteSemesterResponse =
  operations["deleteSemester"]["responses"][204];
export type StartSessionRequest =
  operations["startSession"]["requestBody"]["content"]["application/json"];
export type StartSessionResponse =
  operations["startSession"]["responses"][201]["content"]["application/json"];
export type EndSessionResponse =
  operations["endSession"]["responses"][200]["content"]["application/json"];
export type LiveSessionResponse =
  operations["getLiveSessionRoster"]["responses"][200]["content"]["application/json"];
export type SessionReportResponse =
  operations["getSessionReport"]["responses"][200]["content"]["application/json"];
export type SessionReportItem = SessionReportResponse["items"][number];
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
export type RosterSheetRow =
  components["schemas"]["RosterPage"]["items"][number];
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
