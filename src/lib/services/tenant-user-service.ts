/**
 * Service layer for tenant user operations
 * Encapsulates business logic and validation
 */

import { TenantAwarePrismaClient } from "../prisma/client";
import { PrismaClient } from "../prisma/generated";
import {
  validateTenantUser,
  validateTenantUserRole,
  validateTenantUserStatus,
  TenantUserData,
  TenantRole,
} from "../validation/tenant-constraints";
import {
  TenantBusinessRuleError,
  TenantUserNotFoundError,
} from "../errors/tenant-errors";

export class TenantUserService {
  constructor(private prisma: TenantAwarePrismaClient) {}

  async createUser(userData: unknown) {
    // Validate input schema
    const validatedData = validateTenantUser(userData);

    // Check business rules
    await this.enforceBusinessRules(validatedData);

    // Create user with transaction for data consistency
    return this.prisma.$transaction(async (tx) => {
      // Double-check for race conditions
      const existingUser = await tx.tenant_users.findFirst({
        where: {
          tenant_id: validatedData.tenantId,
          clerk_user_id: validatedData.clerkUserId,
        },
      });

      if (existingUser) {
        throw new TenantBusinessRuleError("User already exists in this tenant");
      }

      // Create user
      return tx.tenant_users.create({
        data: {
          tenant_id: validatedData.tenantId,
          clerk_user_id: validatedData.clerkUserId,
          email: validatedData.email,
          first_name: validatedData.firstName,
          last_name: validatedData.lastName,
          role: validatedData.role,
          status: validatedData.status,
          metadata: validatedData.metadata,
        },
      });
    });
  }

  async updateUserRole(userId: string, newRole: unknown) {
    // Validate role
    const validRole = validateTenantUserRole(newRole);

    return this.prisma.$transaction(async (tx) => {
      // Get current user
      const currentUser = await tx.tenant_users.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new TenantUserNotFoundError("User not found");
      }

      // Check if changing from/to owner role
      if (validRole === "owner" || currentUser.role === "owner") {
        await this.enforceOwnershipRules(
          tx,
          userId,
          validRole,
          currentUser.tenant_id
        );
      }

      // Update user role
      return tx.tenant_users.update({
        where: { id: userId },
        data: { role: validRole },
      });
    });
  }

  async updateUserStatus(userId: string, newStatus: unknown) {
    // Validate status
    const validStatus = validateTenantUserStatus(newStatus);

    return this.prisma.$transaction(async (tx) => {
      // Get current user
      const currentUser = await tx.tenant_users.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new TenantUserNotFoundError("User not found");
      }

      // Check if suspending the last active owner
      if (validStatus === "suspended" && currentUser.role === "owner") {
        const activeOwnerCount = await tx.tenant_users.count({
          where: {
            tenant_id: currentUser.tenant_id,
            role: "owner",
            status: "active",
          },
        });

        if (activeOwnerCount === 1) {
          throw new TenantBusinessRuleError(
            "Cannot suspend the last active owner"
          );
        }
      }

      // Update user status
      return tx.tenant_users.update({
        where: { id: userId },
        data: { status: validStatus },
      });
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get current user
      const currentUser = await tx.tenant_users.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new TenantUserNotFoundError("User not found");
      }

      // Check if deleting the last owner
      if (currentUser.role === "owner") {
        const ownerCount = await tx.tenant_users.count({
          where: {
            tenant_id: currentUser.tenant_id,
            role: "owner",
          },
        });

        if (ownerCount === 1) {
          throw new TenantBusinessRuleError("Cannot delete the last owner");
        }
      }

      // Delete user
      return tx.tenant_users.delete({
        where: { id: userId },
      });
    });
  }

  async getUserById(userId: string) {
    const user = await this.prisma.tenant_users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TenantUserNotFoundError("User not found");
    }

    return user;
  }

  async getUsersByTenant(tenantId: string) {
    return this.prisma.tenant_users.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });
  }

  private async enforceBusinessRules(userData: TenantUserData) {
    // Rule: Only one owner per tenant
    if (userData.role === "owner") {
      const existingOwner = await this.prisma.tenant_users.findFirst({
        where: {
          tenant_id: userData.tenantId,
          role: "owner",
        },
      });

      if (existingOwner) {
        throw new TenantBusinessRuleError("Tenant already has an owner");
      }
    }

    // Rule: Check for duplicate users
    const existingUser = await this.prisma.tenant_users.findFirst({
      where: {
        tenant_id: userData.tenantId,
        clerk_user_id: userData.clerkUserId,
      },
    });

    if (existingUser) {
      throw new TenantBusinessRuleError("User already exists in this tenant");
    }

    // Rule: Check for duplicate email in tenant
    const existingEmail = await this.prisma.tenant_users.findFirst({
      where: {
        tenant_id: userData.tenantId,
        email: userData.email,
      },
    });

    if (existingEmail) {
      throw new TenantBusinessRuleError("Email already exists in this tenant");
    }
  }

  private async enforceOwnershipRules(
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
    userId: string,
    newRole: TenantRole,
    tenantId: string
  ) {
    if (newRole === "owner") {
      // Check if there's already an owner
      const existingOwner = await tx.tenant_users.findFirst({
        where: {
          tenant_id: tenantId,
          role: "owner",
          id: { not: userId },
        },
      });

      if (existingOwner) {
        throw new TenantBusinessRuleError(
          "Cannot assign owner role - tenant already has an owner"
        );
      }
    } else {
      // If removing owner role, ensure there's at least one admin
      const adminCount = await tx.tenant_users.count({
        where: {
          tenant_id: tenantId,
          role: "admin",
          id: { not: userId },
        },
      });

      if (adminCount === 0) {
        throw new TenantBusinessRuleError(
          "Cannot remove owner role - tenant must have at least one admin"
        );
      }
    }
  }
}

