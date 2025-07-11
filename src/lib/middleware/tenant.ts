/**
 * Tenant context middleware for Next.js API routes
 * Extracts tenant information from request and validates access
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Tenant, TenantUser, TenantContext } from "@/types/tenant";

// Simple Prisma client interface for middleware (before generated types are available)
interface SimplePrismaClient {
  tenants: {
    findUnique: (args: { where: { slug: string } }) => Promise<Tenant | null>;
    findFirst: (args: { where: { id: string } }) => Promise<Tenant | null>;
  };
  tenant_users: {
    findFirst: (args: {
      where: { tenant_id: string; clerk_user_id: string; status?: string };
      include?: { tenant: boolean };
    }) => Promise<TenantUser | null>;
  };
}

// Tenant context extraction options
export interface TenantMiddlewareOptions {
  required?: boolean;
  extractFrom?: "header" | "subdomain" | "query" | "path";
  headerName?: string;
  fallbackTenantSlug?: string;
}

// Default options
const DEFAULT_OPTIONS: TenantMiddlewareOptions = {
  required: true,
  extractFrom: "header",
  headerName: "x-tenant-slug",
  fallbackTenantSlug: "default",
};

/**
 * Extract tenant slug from various request sources
 */
export function extractTenantSlug(
  request: NextRequest,
  options: TenantMiddlewareOptions = {}
): string | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (opts.extractFrom) {
    case "header":
      return request.headers.get(opts.headerName!) || null;

    case "subdomain":
      const host = request.headers.get("host");
      if (host) {
        const subdomain = host.split(".")[0];
        return subdomain !== "www" && subdomain !== "localhost"
          ? subdomain
          : null;
      }
      return null;

    case "query":
      return request.nextUrl.searchParams.get("tenant") || null;

    case "path":
      const pathSegments = request.nextUrl.pathname.split("/");
      return pathSegments[1] || null;

    default:
      return null;
  }
}

/**
 * Get tenant context from request
 */
export async function getTenantContext(
  request: NextRequest,
  prisma: SimplePrismaClient,
  options: TenantMiddlewareOptions = {}
): Promise<TenantContext | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Extract tenant slug
  let tenantSlug = extractTenantSlug(request, opts);

  // Fall back to default tenant if none found and not required
  if (!tenantSlug && !opts.required && opts.fallbackTenantSlug) {
    tenantSlug = opts.fallbackTenantSlug;
  }

  // If tenant is required but not found, throw error
  if (!tenantSlug && opts.required) {
    throw new Error("Tenant context is required but not provided");
  }

  if (!tenantSlug) {
    return null;
  }

  // Get tenant from database
  const tenant = await prisma.tenants.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  // Get authenticated user
  const { userId } = auth();
  if (!userId) {
    throw new Error("User authentication required");
  }

  // Get tenant user
  const tenantUser = await prisma.tenant_users.findFirst({
    where: {
      tenant_id: tenant.id,
      clerk_user_id: userId,
    },
    include: {
      tenant: true,
    },
  });

  if (!tenantUser) {
    throw new Error(`User not found in tenant: ${tenantSlug}`);
  }

  // Get user permissions based on role
  const permissions = getRolePermissions(tenantUser.role);

  return {
    tenant,
    user: tenantUser,
    permissions,
  };
}

/**
 * Validate tenant access for authenticated user
 */
export async function validateTenantAccess(
  tenantId: string,
  clerkUserId: string,
  prisma: SimplePrismaClient
): Promise<TenantUser | null> {
  const tenantUser = await prisma.tenant_users.findFirst({
    where: {
      tenant_id: tenantId,
      clerk_user_id: clerkUserId,
      status: "active",
    },
    include: {
      tenant: true,
    },
  });

  return tenantUser;
}

/**
 * Get permissions for a user role
 */
function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
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

  return permissions[role] || [];
}

/**
 * Middleware factory for protecting API routes with tenant context
 */
export function withTenantContext(
  handler: (
    request: NextRequest,
    context: { tenant: TenantContext; params?: Record<string, string> }
  ) => Promise<Response>,
  options: TenantMiddlewareOptions = {}
) {
  return async (
    request: NextRequest,
    { params }: { params?: Record<string, string> }
  ) => {
    try {
      // This is a placeholder - in real implementation, prisma would be injected
      const prisma = {} as SimplePrismaClient;

      const tenantContext = await getTenantContext(request, prisma, options);

      if (!tenantContext && options.required !== false) {
        return new Response("Tenant context required", { status: 400 });
      }

      return handler(request, { tenant: tenantContext!, params });
    } catch (error) {
      console.error("Tenant middleware error:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return new Response("Tenant not found", { status: 404 });
        }
        if (error.message.includes("required")) {
          return new Response("Tenant context required", { status: 400 });
        }
        if (error.message.includes("authentication")) {
          return new Response("Authentication required", { status: 401 });
        }
      }

      return new Response("Internal server error", { status: 500 });
    }
  };
}

/**
 * Higher-order function to wrap API route handlers with tenant context
 * Usage: export const GET = withTenant(async (request, { tenant }) => { ... })
 */
export function withTenant(
  handler: (
    request: NextRequest,
    context: { tenant: TenantContext; params?: Record<string, string> }
  ) => Promise<Response>,
  options: TenantMiddlewareOptions = {}
) {
  return withTenantContext(handler, options);
}

/**
 * Utility to check if user has specific permission
 */
export function checkPermission(
  context: TenantContext,
  permission: string
): boolean {
  return context.permissions.includes(permission);
}

/**
 * Utility to require specific permission (throws if not present)
 */
export function requirePermission(
  context: TenantContext,
  permission: string
): void {
  if (!checkPermission(context, permission)) {
    throw new Error(`Insufficient permissions: ${permission}`);
  }
}

