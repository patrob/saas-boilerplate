/**
 * Tenant-aware API route for user management
 * GET /api/tenants/[slug]/users - List users in a tenant
 * POST /api/tenants/[slug]/users - Create a new user in the tenant
 * PUT /api/tenants/[slug]/users/[id] - Update a user in the tenant
 * DELETE /api/tenants/[slug]/users/[id] - Delete a user from the tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { TenantAwarePrismaClient } from "@/lib/prisma/client";
import { TenantUserService } from "@/lib/services/tenant-user-service";
import { TenantService } from "@/lib/services/tenant-service";
import {
  TenantBusinessRuleError,
  TenantValidationError,
  TenantNotFoundError,
  TenantUserNotFoundError,
  isTenantError,
  getTenantErrorStatusCode,
} from "@/lib/errors/tenant-errors";

// Validation schemas for API requests
const createUserSchema = z.object({
  clerkUserId: z.string().min(1, "Clerk user ID is required"),
  email: z.string().email("Valid email is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

const updateUserRoleSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

const updateUserStatusSchema = z.object({
  status: z.enum(["active", "suspended", "cancelled"]),
});

// Helper function to get tenant by slug
async function getTenantBySlug(slug: string) {
  const prisma = new TenantAwarePrismaClient();
  const tenantService = new TenantService(prisma);

  try {
    return await tenantService.getTenantBySlug(slug);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to handle API errors
function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.errors },
      { status: 400 }
    );
  }

  if (isTenantError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: getTenantErrorStatusCode(error) }
    );
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * GET /api/tenants/[slug]/users
 * List all users in a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15
    const { slug } = await params;

    // Get tenant
    const tenant = await getTenantBySlug(slug);

    // Initialize services
    const prisma = new TenantAwarePrismaClient();
    const tenantService = new TenantService(prisma);

    try {
      // Get users
      const users = await tenantService.getTenantUsers(tenant.id);

      return NextResponse.json(users);
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/tenants/[slug]/users
 * Create a new user in the tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createUserSchema.parse(body);

    // Await params in Next.js 15
    const { slug } = await params;

    // Get tenant
    const tenant = await getTenantBySlug(slug);

    // Initialize services
    const prisma = new TenantAwarePrismaClient();
    const userService = new TenantUserService(
      prisma.setTenantContext(tenant.id)
    );

    try {
      // Create user
      const user = await userService.createUser({
        tenantId: tenant.id,
        clerkUserId: validatedData.clerkUserId,
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
        status: "active",
      });

      return NextResponse.json(user, { status: 201 });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    return handleApiError(error);
  }
}

