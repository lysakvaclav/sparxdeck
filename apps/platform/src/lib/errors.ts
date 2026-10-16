// Error codes are translation keys under "errors" in messages/*.json, so server
// actions return a code and the UI renders it in the user's language.
export type ErrorCode =
  | "required"
  | "emailInvalid"
  | "passwordTooShort"
  | "passwordMismatch"
  | "tooLong"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userExists"
  | "weakPassword"
  | "rateLimited"
  | "linkInvalid"
  | "alreadyMember"
  | "alreadyInvited"
  | "alreadyInTeam"
  | "forbidden"
  | "invitationNotFound"
  | "invitationExpired"
  | "invitationUsed"
  | "invitationEmailMismatch"
  | "passwordTooCommon"
  | "passwordContainsEmail"
  | "wrongPassword"
  | "sameEmail"
  | "ownerProtected"
  | "cannotChangeSelf"
  | "memberNotFound"
  | "companyIdInvalid"
  | "vatIdInvalid"
  | "phoneInvalid"
  | "dueSoonDaysInvalid"
  | "timezoneInvalid"
  | "fileTooLarge"
  | "fileTypeInvalid"
  | "customerDeleted"
  | "locationsMismatch"
  | "notFound"
  | "intervalInvalid"
  | "templateInvalid"
  | "templateEmpty"
  | "templateTooLong"
  | "defectNeedsPassFail"
  | "dateInvalid"
  | "dateInFuture"
  | "yearInvalid"
  | "countInvalid"
  | "serialCountMismatch"
  | "siteDeleted"
  | "labelsNone"
  | "labelsTooMany"
  | "copiesInvalid"
  | "startInvalid"
  | "layoutInvalid"
  | "labelsDontFit"
  | "checksUnfinished"
  | "inspectionClosed"
  | "checkTakenOver"
  | "checkIncomplete"
  | "deviceInactive"
  | "noTemplate"
  | "invalidAnswer"
  | "tooManyPhotos"
  | "photoFailed"
  | "invalidDefect"
  | "resolutionRequired"
  | "inspectionOpen"
  | "protocolFailed"
  | "protocolMissing"
  | "emailDisabled"
  | "emailFailed"
  | "sampleExists"
  | "noDeviceType"
  | "planUnreadable"
  | "floorPlansMismatch"
  | "unexpected";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: ErrorCode; fieldErrors?: Partial<Record<string, ErrorCode>> };

/** Maps Supabase Auth error codes to our error codes. */
export function authErrorCode(
  error: { code?: string; status?: number } | null | undefined,
): ErrorCode {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "userExists";
    case "weak_password":
      return "weakPassword";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return "linkInvalid";
    default:
      return error?.status === 429 ? "rateLimited" : "unexpected";
  }
}

/** Maps exceptions raised by our database functions (see migrations) to error codes. */
export function databaseErrorCode(
  error: { message?: string; code?: string } | null | undefined,
): ErrorCode {
  const message = error?.message ?? "";
  if (message.includes("already_member")) return "alreadyMember";
  if (message.includes("invitation_not_found")) return "invitationNotFound";
  if (message.includes("invitation_expired")) return "invitationExpired";
  if (message.includes("invitation_used")) return "invitationUsed";
  if (message.includes("invitation_email_mismatch")) return "invitationEmailMismatch";
  if (message.includes("owner_protected") || message.includes("use_transfer_ownership"))
    return "ownerProtected";
  if (message.includes("cannot_change_self")) return "cannotChangeSelf";
  if (message.includes("member_not_found")) return "memberNotFound";
  if (message.includes("forbidden")) return "forbidden";
  if (message.includes("invalid_timezone")) return "timezoneInvalid";
  if (message.includes("customer_deleted")) return "customerDeleted";
  if (message.includes("site_deleted")) return "siteDeleted";
  if (message.includes("locations_mismatch")) return "locationsMismatch";
  if (message.includes("floor_plans_mismatch")) return "floorPlansMismatch";
  if (message.includes("invalid_template")) return "templateInvalid";
  if (message.includes("checks_unfinished")) return "checksUnfinished";
  if (message.includes("inspection_closed")) return "inspectionClosed";
  if (message.includes("check_taken_over")) return "checkTakenOver";
  if (message.includes("check_incomplete")) return "checkIncomplete";
  if (message.includes("device_inactive")) return "deviceInactive";
  if (message.includes("no_template")) return "noTemplate";
  if (message.includes("invalid_answer")) return "invalidAnswer";
  if (message.includes("too_many_photos")) return "tooManyPhotos";
  if (message.includes("invalid_defect")) return "invalidDefect";
  if (message.includes("resolution_required")) return "resolutionRequired";
  if (message.includes("inspection_open")) return "inspectionOpen";
  if (message.includes("protocol_missing")) return "protocolMissing";
  if (message.includes("sample_exists")) return "sampleExists";
  if (message.includes("no_device_type")) return "noDeviceType";
  if (message.includes("not_found")) return "notFound";
  if (error?.code === "42501") return "forbidden";
  if (error?.code === "23505") return "alreadyInvited";
  return "unexpected";
}

/** First error code per field of a failed Zod parse, in the shape forms expect. */
export function zodFieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Extract<ActionResult, { ok: false }> {
  const result: Partial<Record<string, ErrorCode>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !result[field]) result[field] = issue.message as ErrorCode;
  }
  return { ok: false, error: "required", fieldErrors: result };
}
