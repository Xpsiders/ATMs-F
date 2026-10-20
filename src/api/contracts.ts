import type { operations } from "./schema";

export type SessionCodeResponse =
  operations["getSessionCode"]["responses"][200]["content"]["application/json"];
export type LoginResponse =
  operations["login"]["responses"][200]["content"]["application/json"];
export type CheckInRequest =
  operations["createCheckIn"]["requestBody"]["content"]["application/json"];
export type CheckInResponse =
  operations["createCheckIn"]["responses"][200]["content"]["application/json"];
export type RosterSheetRow =
  operations["getRosterSheet"]["responses"][200]["content"]["application/json"][number];
export type SessionPatchResponse =
  operations["updateSession"]["responses"][200]["content"]["application/json"];
export type AttendanceOverrideRequest =
  operations["createAttendanceOverride"]["requestBody"]["content"]["application/json"];
export type BulkOverrideResponse =
  operations["createBulkAttendanceOverride"]["responses"][200]["content"]["application/json"];
export type SignupClaimRequest =
  operations["claimSignup"]["requestBody"]["content"]["application/json"];
export type SignupVerifyRequest =
  operations["verifySignupCode"]["requestBody"]["content"]["application/json"];
export type SignupPasswordRequest =
  operations["setSignupPassword"]["requestBody"]["content"]["application/json"];
export type ForgotPasswordRequest =
  operations["requestPasswordReset"]["requestBody"]["content"]["application/json"];
export type ResetPasswordRequest =
  operations["resetPassword"]["requestBody"]["content"]["application/json"];
export type ChangePasswordRequest =
  operations["changePassword"]["requestBody"]["content"]["application/json"];
export type PasswordCodeRequest =
  operations["verifyPasswordResetCode"]["requestBody"]["content"]["application/json"];
export type SessionPatchRequest =
  operations["updateSession"]["requestBody"]["content"]["application/json"];
