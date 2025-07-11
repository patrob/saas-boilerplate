/**
 * Tests for tenant user service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TenantUserService } from "../tenant-user-service";
import { TenantAwarePrismaClient } from "../../prisma/client";
import {
  TenantBusinessRuleError,
  TenantUserNotFoundError,
} from "../../errors/tenant-errors";

// Mock TenantAwarePrismaClient
const mockPrisma = {
  tenant_users: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
  $disconnect: vi.fn(),
};

describe("TenantUserService", () => {
  let service: TenantUserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantUserService(
      mockPrisma as unknown as TenantAwarePrismaClient
    );
  });

  describe("createUser", () => {
    it("should create a user with valid data", async () => {
      const userData = {
        tenantId: "00000000-0000-0000-0000-000000000001",
        clerkUserId: "user_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "member",
        status: "active",
      };

      const mockCreatedUser = {
        id: "00000000-0000-0000-0000-000000000002",
        ...userData,
        created_at: new Date(),
      };

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findFirst.mockResolvedValue(null);
        mockPrisma.tenant_users.create.mockResolvedValue(mockCreatedUser);
        return callback(mockPrisma);
      });

      const result = await service.createUser(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(mockPrisma.tenant_users.create).toHaveBeenCalledWith({
        data: {
          tenant_id: userData.tenantId,
          clerk_user_id: userData.clerkUserId,
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
          status: userData.status,
          metadata: {},
        },
      });
    });

    it("should throw error when trying to create second owner", async () => {
      const userData = {
        tenantId: "00000000-0000-0000-0000-000000000001",
        clerkUserId: "user_123",
        email: "test@example.com",
        role: "owner",
        status: "active",
      };

      mockPrisma.tenant_users.findFirst.mockResolvedValue({
        id: "existing-owner",
        role: "owner",
      });

      await expect(service.createUser(userData)).rejects.toThrow(
        TenantBusinessRuleError
      );
    });

    it("should throw error when user already exists", async () => {
      const userData = {
        tenantId: "00000000-0000-0000-0000-000000000001",
        clerkUserId: "user_123",
        email: "test@example.com",
        role: "member",
        status: "active",
      };

      mockPrisma.tenant_users.findFirst
        .mockResolvedValueOnce(null) // No existing owner
        .mockResolvedValueOnce({ id: "existing-user" }); // User already exists

      await expect(service.createUser(userData)).rejects.toThrow(
        TenantBusinessRuleError
      );
    });

    it("should throw error with invalid email", async () => {
      const userData = {
        tenantId: "00000000-0000-0000-0000-000000000001",
        clerkUserId: "user_123",
        email: "invalid-email",
        role: "member",
        status: "active",
      };

      await expect(service.createUser(userData)).rejects.toThrow();
    });

    it("should throw error with invalid role", async () => {
      const userData = {
        tenantId: "00000000-0000-0000-0000-000000000001",
        clerkUserId: "user_123",
        email: "test@example.com",
        role: "invalid-role",
        status: "active",
      };

      await expect(service.createUser(userData)).rejects.toThrow();
    });
  });

  describe("updateUserRole", () => {
    it("should update user role successfully", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";
      const newRole = "admin";

      const mockUser = {
        id: userId,
        role: "member",
        tenant_id: "00000000-0000-0000-0000-000000000002",
      };

      const mockUpdatedUser = {
        ...mockUser,
        role: newRole,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(mockUser);
        mockPrisma.tenant_users.update.mockResolvedValue(mockUpdatedUser);
        return callback(mockPrisma);
      });

      const result = await service.updateUserRole(userId, newRole);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockPrisma.tenant_users.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: newRole },
      });
    });

    it("should throw error when user not found", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";
      const newRole = "admin";

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(null);
        return callback(mockPrisma);
      });

      await expect(service.updateUserRole(userId, newRole)).rejects.toThrow(
        TenantUserNotFoundError
      );
    });

    it("should enforce ownership rules when assigning owner role", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";
      const newRole = "owner";

      const mockUser = {
        id: userId,
        role: "admin",
        tenant_id: "00000000-0000-0000-0000-000000000002",
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(mockUser);
        mockPrisma.tenant_users.findFirst.mockResolvedValue({
          id: "existing-owner",
          role: "owner",
        });
        return callback(mockPrisma);
      });

      await expect(service.updateUserRole(userId, newRole)).rejects.toThrow(
        TenantBusinessRuleError
      );
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";

      const mockUser = {
        id: userId,
        role: "member",
        tenant_id: "00000000-0000-0000-0000-000000000002",
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(mockUser);
        mockPrisma.tenant_users.delete.mockResolvedValue(mockUser);
        return callback(mockPrisma);
      });

      const result = await service.deleteUser(userId);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.tenant_users.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it("should throw error when trying to delete last owner", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";

      const mockUser = {
        id: userId,
        role: "owner",
        tenant_id: "00000000-0000-0000-0000-000000000002",
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(mockUser);
        mockPrisma.tenant_users.count.mockResolvedValue(1); // Only one owner
        return callback(mockPrisma);
      });

      await expect(service.deleteUser(userId)).rejects.toThrow(
        TenantBusinessRuleError
      );
    });

    it("should throw error when user not found", async () => {
      const userId = "00000000-0000-0000-0000-000000000001";

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.tenant_users.findUnique.mockResolvedValue(null);
        return callback(mockPrisma);
      });

      await expect(service.deleteUser(userId)).rejects.toThrow(
        TenantUserNotFoundError
      );
    });
  });
});

