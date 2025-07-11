/**
 * Validation layer for tenant constraints
 * Replaces database check constraints with application-level validation
 */

import { z } from "zod";

// Define all enum types with runtime validation
export const TenantRoleEnum = z.enum(["owner", "admin", "member", "viewer"]);
export const TenantStatusEnum = z.enum(["active", "suspended", "cancelled"]);
export const InvitationStatusEnum = z.enum([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

// Business rule validation schemas
export const TenantUserSchema = z
  .object({
    tenantId: z.string().uuid("Tenant ID must be a valid UUID"),
    clerkUserId: z.string().min(1, "Clerk user ID is required"),
    email: z
      .string()
      .email("Valid email is required")
      .max(255, "Email must be 255 characters or less"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: TenantRoleEnum.default("member"),
    status: TenantStatusEnum.default("active"),
    metadata: z.record(z.any()).optional().default({}),
  })
  .refine(
    (data) => {
      // Additional business rule validations
      if (data.email.length > 255) {
        return false;
      }
      return true;
    },
    { message: "Email must be 255 characters or less" }
  );

export const TenantInvitationSchema = z
  .object({
    tenantId: z.string().uuid("Tenant ID must be a valid UUID"),
    email: z
      .string()
      .email("Valid email is required")
      .max(255, "Email must be 255 characters or less"),
    role: TenantRoleEnum.default("member"),
    status: InvitationStatusEnum.default("pending"),
    invitedBy: z.string().uuid("Invited by must be a valid UUID").optional(),
    token: z.string().min(1, "Token is required"),
    expiresAt: z
      .date()
      .min(new Date(), "Expiration date must be in the future"),
  })
  .refine((data) => data.expiresAt > new Date(), {
    message: "Invitation expiration must be in the future",
  });

export const TenantSchema = z.object({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be no more than 50 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be no more than 100 characters"),
  settings: z.record(z.any()).optional().default({}),
  status: TenantStatusEnum.default("active"),
});

export const UpdateTenantUserRoleSchema = z.object({
  role: TenantRoleEnum,
});

export const UpdateTenantUserStatusSchema = z.object({
  status: TenantStatusEnum,
});

// Type exports for TypeScript
export type TenantRole = z.infer<typeof TenantRoleEnum>;
export type TenantStatus = z.infer<typeof TenantStatusEnum>;
export type InvitationStatus = z.infer<typeof InvitationStatusEnum>;
export type TenantUserData = z.infer<typeof TenantUserSchema>;
export type TenantInvitationData = z.infer<typeof TenantInvitationSchema>;
export type TenantData = z.infer<typeof TenantSchema>;

// Validation helper functions
export function validateTenantUser(data: unknown): TenantUserData {
  return TenantUserSchema.parse(data);
}

export function validateTenantInvitation(data: unknown): TenantInvitationData {
  return TenantInvitationSchema.parse(data);
}

export function validateTenant(data: unknown): TenantData {
  return TenantSchema.parse(data);
}

export function validateTenantUserRole(role: unknown): TenantRole {
  return TenantRoleEnum.parse(role);
}

export function validateTenantUserStatus(status: unknown): TenantStatus {
  return TenantStatusEnum.parse(status);
}

