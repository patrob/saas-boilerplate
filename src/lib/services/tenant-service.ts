/**
 * Service layer for tenant operations
 * Handles tenant creation, updates, and management
 */

import { TenantAwarePrismaClient } from "../prisma/client";
import { validateTenant } from "../validation/tenant-constraints";
import {
  TenantBusinessRuleError,
  TenantNotFoundError,
} from "../errors/tenant-errors";

export class TenantService {
  constructor(private prisma: TenantAwarePrismaClient) {}

  async createTenant(
    tenantData: unknown,
    ownerClerkUserId: string,
    ownerEmail: string
  ) {
    // Validate input schema
    const validatedData = validateTenant(tenantData);

    return this.prisma.$transaction(async (tx) => {
      // Check if slug is already taken
      const existingTenant = await tx.tenants.findUnique({
        where: { slug: validatedData.slug },
      });

      if (existingTenant) {
        throw new TenantBusinessRuleError("Tenant slug already exists");
      }

      // Create tenant
      const tenant = await tx.tenants.create({
        data: {
          slug: validatedData.slug,
          name: validatedData.name,
          settings: validatedData.settings,
          status: validatedData.status,
        },
      });

      // Create owner user
      const ownerUser = await tx.tenant_users.create({
        data: {
          tenant_id: tenant.id,
          clerk_user_id: ownerClerkUserId,
          email: ownerEmail,
          role: "owner",
          status: "active",
        },
      });

      return { tenant, owner: ownerUser };
    });
  }

  async updateTenant(tenantId: string, updateData: unknown) {
    // Validate input schema (partial update)
    const validatedData = validateTenant(updateData);

    return this.prisma.$transaction(async (tx) => {
      // Check if tenant exists
      const existingTenant = await tx.tenants.findUnique({
        where: { id: tenantId },
      });

      if (!existingTenant) {
        throw new TenantNotFoundError("Tenant not found");
      }

      // Check if slug is already taken (if updating slug)
      if (validatedData.slug && validatedData.slug !== existingTenant.slug) {
        const slugExists = await tx.tenants.findUnique({
          where: { slug: validatedData.slug },
        });

        if (slugExists) {
          throw new TenantBusinessRuleError("Tenant slug already exists");
        }
      }

      // Update tenant
      return tx.tenants.update({
        where: { id: tenantId },
        data: validatedData,
      });
    });
  }

  async getTenantById(tenantId: string) {
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new TenantNotFoundError("Tenant not found");
    }

    return tenant;
  }

  async getTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenants.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new TenantNotFoundError("Tenant not found");
    }

    return tenant;
  }

  async suspendTenant(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if tenant exists
      const existingTenant = await tx.tenants.findUnique({
        where: { id: tenantId },
      });

      if (!existingTenant) {
        throw new TenantNotFoundError("Tenant not found");
      }

      if (existingTenant.status === "suspended") {
        throw new TenantBusinessRuleError("Tenant is already suspended");
      }

      // Update tenant status
      return tx.tenants.update({
        where: { id: tenantId },
        data: { status: "suspended" },
      });
    });
  }

  async activateTenant(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if tenant exists
      const existingTenant = await tx.tenants.findUnique({
        where: { id: tenantId },
      });

      if (!existingTenant) {
        throw new TenantNotFoundError("Tenant not found");
      }

      if (existingTenant.status === "active") {
        throw new TenantBusinessRuleError("Tenant is already active");
      }

      // Update tenant status
      return tx.tenants.update({
        where: { id: tenantId },
        data: { status: "active" },
      });
    });
  }

  async deleteTenant(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if tenant exists
      const existingTenant = await tx.tenants.findUnique({
        where: { id: tenantId },
      });

      if (!existingTenant) {
        throw new TenantNotFoundError("Tenant not found");
      }

      // Check if tenant has any users
      const userCount = await tx.tenant_users.count({
        where: { tenant_id: tenantId },
      });

      if (userCount > 0) {
        throw new TenantBusinessRuleError(
          "Cannot delete tenant with active users"
        );
      }

      // Delete tenant (cascade will handle related records)
      return tx.tenants.delete({
        where: { id: tenantId },
      });
    });
  }

  async getTenantUsers(tenantId: string) {
    return this.prisma.tenant_users.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });
  }

  async getTenantOwner(tenantId: string) {
    const owner = await this.prisma.tenant_users.findFirst({
      where: {
        tenant_id: tenantId,
        role: "owner",
      },
    });

    if (!owner) {
      throw new TenantNotFoundError("Tenant owner not found");
    }

    return owner;
  }

  async getTenantStats(tenantId: string) {
    const [userCount, adminCount, pendingInvitations] = await Promise.all([
      this.prisma.tenant_users.count({
        where: { tenant_id: tenantId },
      }),
      this.prisma.tenant_users.count({
        where: {
          tenant_id: tenantId,
          role: { in: ["owner", "admin"] },
        },
      }),
      this.prisma.tenant_invitations.count({
        where: {
          tenant_id: tenantId,
          status: "pending",
          expires_at: { gt: new Date() },
        },
      }),
    ]);

    return {
      totalUsers: userCount,
      adminUsers: adminCount,
      pendingInvitations,
    };
  }
}

