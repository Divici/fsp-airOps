// ---------------------------------------------------------------------------
// Session & Tenant Types
// ---------------------------------------------------------------------------

export interface UserSession {
  userId: string; // FSP user GUID
  email: string;
  operatorId: number; // current tenant
  operators: number[]; // operators the user has access to
  token: string; // FSP bearer token
  expiresAt: Date;
}

export interface TenantContext {
  operatorId: number;
  userId: string;
}
