/**
 * TypeScript types for tenant context and multi-tenant operations
 */

// Core tenant types - updated to match validation schemas
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  status: "active" | "suspended" | "cancelled";
  created_at: Date;
  updated_at: Date;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  clerk_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "suspended" | "cancelled";
  metadata: Record<string, unknown>;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
  tenant?: Tenant;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  invited_by?: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
  tenant?: Tenant;
  inviter?: TenantUser;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  tenant?: Tenant;
  user?: TenantUser;
}

export interface TenantSetting {
  id: string;
  tenant_id: string;
  key: string;
  value?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  tenant?: Tenant;
}

// Tenant context types
export interface TenantContext {
  tenant: Tenant;
  user: TenantUser;
  permissions: string[];
}

// API request/response types
export interface CreateTenantRequest {
  name: string;
  slug: string;
  clerkUserId: string;
  email: string;
}

export interface CreateTenantResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    role: string;
  };
}

export interface InviteUserRequest {
  email: string;
  role: "admin" | "user" | "viewer";
}

export interface InviteUserResponse {
  invitation: {
    id: string;
    email: string;
    role: string;
    token: string;
    expires_at: Date;
  };
}

// Middleware types
export interface TenantMiddlewareRequest {
  tenantSlug?: string;
  tenantId?: string;
  userId?: string;
}

export interface TenantMiddlewareResponse {
  tenant: Tenant | null;
  user: TenantUser | null;
  error?: string;
}

// Error types
export class TenantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Tenant not found: ${identifier}`);
    this.name = "TenantNotFoundError";
  }
}

export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = "UserNotFoundError";
  }
}

export class InsufficientPermissionsError extends Error {
  constructor(action: string) {
    super(`Insufficient permissions for action: ${action}`);
    this.name = "InsufficientPermissionsError";
  }
}

export class TenantContextMissingError extends Error {
  constructor() {
    super("Tenant context is required but not provided");
    this.name = "TenantContextMissingError";
  }
}

// Utility types
export type UserRole = "admin" | "user" | "viewer";
export type TenantStatus = "active" | "suspended" | "deleted";
export type UserStatus = "active" | "inactive" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

// Permission checking utilities
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "tenant:read",
    "tenant:update",
    "tenant:delete",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "invitation:create",
    "invitation:delete",
    "settings:read",
    "settings:update",
    "audit:read",
  ],
  user: ["tenant:read", "user:read", "settings:read"],
  viewer: ["tenant:read", "user:read"],
};

export function hasPermission(userRole: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

export function checkPermission(userRole: UserRole, permission: string): void {
  if (!hasPermission(userRole, permission)) {
    throw new InsufficientPermissionsError(permission);
  }
}

