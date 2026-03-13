// ---------------------------------------------------------------------------
// Barrel export for auth module
// ---------------------------------------------------------------------------

export type { UserSession, TenantContext } from "./types";
export {
  getTenantFromRequest,
  getTenantFromSession,
  validateTenantAccess,
  TenantResolutionError,
  DEV_DEFAULT_OPERATOR_ID,
} from "./tenant-context";
export { getCurrentSession, createSession } from "./session";
export type { FspAuthResponse } from "./session";
