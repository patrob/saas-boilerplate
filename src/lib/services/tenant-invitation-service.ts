/**
 * Service layer for tenant invitation operations
 * Handles invitation creation, acceptance, and expiration
 */

import { TenantAwarePrismaClient } from "../prisma/client";
import { validateTenantInvitation } from "../validation/tenant-constraints";
import {
  TenantBusinessRuleError,
  TenantNotFoundError,
} from "../errors/tenant-errors";
import { randomBytes } from "crypto";

export class TenantInvitationService {
  constructor(private prisma: TenantAwarePrismaClient) {}

  async createInvitation(invitationData: unknown) {
    // Generate a secure token
    const token = randomBytes(32).toString("hex");

    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Validate input schema
    const validatedData = validateTenantInvitation({
      ...(invitationData as Record<string, unknown>),
      token,
      expiresAt,
    });

    return this.prisma.$transaction(async (tx) => {
      // Check if user is already invited
      const existingInvitation = await tx.tenant_invitations.findFirst({
        where: {
          tenant_id: validatedData.tenantId,
          email: validatedData.email,
          status: "pending",
        },
      });

      if (existingInvitation) {
        throw new TenantBusinessRuleError(
          "User already has a pending invitation"
        );
      }

      // Check if user is already a member
      const existingMember = await tx.tenant_users.findFirst({
        where: {
          tenant_id: validatedData.tenantId,
          email: validatedData.email,
        },
      });

      if (existingMember) {
        throw new TenantBusinessRuleError(
          "User is already a member of this tenant"
        );
      }

      // Business rule: Only one owner per tenant
      if (validatedData.role === "owner") {
        const existingOwner = await tx.tenant_users.findFirst({
          where: {
            tenant_id: validatedData.tenantId,
            role: "owner",
          },
        });

        if (existingOwner) {
          throw new TenantBusinessRuleError("Tenant already has an owner");
        }
      }

      // Create invitation
      return tx.tenant_invitations.create({
        data: {
          tenant_id: validatedData.tenantId,
          email: validatedData.email,
          role: validatedData.role,
          invited_by: validatedData.invitedBy,
          token: validatedData.token,
          status: validatedData.status,
          expires_at: validatedData.expiresAt,
        },
      });
    });
  }

  async acceptInvitation(invitationId: string, clerkUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get invitation
      const invitation = await tx.tenant_invitations.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.status !== "pending") {
        throw new TenantBusinessRuleError("Invalid or expired invitation");
      }

      if (invitation.expires_at < new Date()) {
        // Mark as expired
        await tx.tenant_invitations.update({
          where: { id: invitationId },
          data: { status: "expired" },
        });
        throw new TenantBusinessRuleError("Invitation has expired");
      }

      // Check if user is already a member (race condition protection)
      const existingMember = await tx.tenant_users.findFirst({
        where: {
          tenant_id: invitation.tenant_id,
          clerk_user_id: clerkUserId,
        },
      });

      if (existingMember) {
        throw new TenantBusinessRuleError(
          "User is already a member of this tenant"
        );
      }

      // Business rule: Only one owner per tenant
      if (invitation.role === "owner") {
        const existingOwner = await tx.tenant_users.findFirst({
          where: {
            tenant_id: invitation.tenant_id,
            role: "owner",
          },
        });

        if (existingOwner) {
          throw new TenantBusinessRuleError("Tenant already has an owner");
        }
      }

      // Create user
      const user = await tx.tenant_users.create({
        data: {
          tenant_id: invitation.tenant_id,
          clerk_user_id: clerkUserId,
          email: invitation.email,
          role: invitation.role,
          status: "active",
        },
      });

      // Update invitation status
      await tx.tenant_invitations.update({
        where: { id: invitationId },
        data: {
          status: "accepted",
          accepted_at: new Date(),
        },
      });

      return user;
    });
  }

  async revokeInvitation(invitationId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get invitation
      const invitation = await tx.tenant_invitations.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new TenantNotFoundError("Invitation not found");
      }

      if (invitation.status !== "pending") {
        throw new TenantBusinessRuleError(
          "Only pending invitations can be revoked"
        );
      }

      // Update invitation status
      return tx.tenant_invitations.update({
        where: { id: invitationId },
        data: { status: "revoked" },
      });
    });
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.tenant_invitations.findFirst({
      where: { token },
    });

    if (!invitation) {
      throw new TenantNotFoundError("Invitation not found");
    }

    return invitation;
  }

  async getInvitationsByTenant(tenantId: string) {
    return this.prisma.tenant_invitations.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });
  }

  async getPendingInvitationsByTenant(tenantId: string) {
    return this.prisma.tenant_invitations.findMany({
      where: {
        tenant_id: tenantId,
        status: "pending",
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async cleanupExpiredInvitations() {
    // Mark expired invitations
    const expiredCount = await this.prisma.tenant_invitations.updateMany({
      where: {
        status: "pending",
        expires_at: { lt: new Date() },
      },
      data: { status: "expired" },
    });

    return expiredCount;
  }
}

