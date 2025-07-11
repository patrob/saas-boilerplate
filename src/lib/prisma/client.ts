/**
 * Tenant-aware Prisma client for multi-tenant SaaS application
 * Automatically handles tenant context for Row Level Security
 */

import { PrismaClient } from "./generated";

// Extend PrismaClient with tenant awareness
class TenantAwarePrismaClient extends PrismaClient {
  private tenantId: string | null = null;

  /**
   * Set the tenant context for this client instance
   */
  setTenantContext(tenantId: string) {
    this.tenantId = tenantId;
    return this;
  }

  /**
   * Get the current tenant context
   */
  getTenantContext(): string | null {
    return this.tenantId;
  }

  /**
   * Execute queries with tenant context automatically set
   */
  async withTenantContext<T>(
    tenantId: string,
    callback: () => Promise<T>
  ): Promise<T> {
    // Set tenant context in PostgreSQL session
    await this
      .$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

    try {
      return await callback();
    } finally {
      // Clear tenant context after query
      await this
        .$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
    }
  }

  /**
   * Override query methods to automatically inject tenant context
   */
  private async executeWithTenantContext<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    if (!this.tenantId) {
      throw new Error("Tenant context not set. Call setTenantContext() first.");
    }

    return this.withTenantContext(this.tenantId, callback);
  }

  // Override tenant-specific table operations to require tenant context
  get tenantUsers() {
    const originalMethods = super.tenant_users;

    return {
      ...originalMethods,
      findMany: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findMany(args)),
      findFirst: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findFirst(args)),
      findUnique: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findUnique(args)),
      create: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.create({
            ...args,
            data: { ...args.data, tenant_id: this.tenantId },
          })
        ),
      update: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.update(args)),
      delete: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.delete(args)),
      upsert: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.upsert({
            ...args,
            create: { ...args.create, tenant_id: this.tenantId },
          })
        ),
      count: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.count(args)),
    };
  }

  get tenantInvitations() {
    const originalMethods = super.tenant_invitations;

    return {
      ...originalMethods,
      findMany: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findMany(args)),
      findFirst: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findFirst(args)),
      findUnique: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findUnique(args)),
      create: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.create({
            ...args,
            data: { ...args.data, tenant_id: this.tenantId },
          })
        ),
      update: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.update(args)),
      delete: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.delete(args)),
      count: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.count(args)),
    };
  }

  get auditLogs() {
    const originalMethods = super.audit_logs;

    return {
      ...originalMethods,
      findMany: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findMany(args)),
      findFirst: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findFirst(args)),
      create: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.create({
            ...args,
            data: { ...args.data, tenant_id: this.tenantId },
          })
        ),
      count: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.count(args)),
    };
  }

  get tenantSettings() {
    const originalMethods = super.tenant_settings;

    return {
      ...originalMethods,
      findMany: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findMany(args)),
      findFirst: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findFirst(args)),
      findUnique: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.findUnique(args)),
      create: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.create({
            ...args,
            data: { ...args.data, tenant_id: this.tenantId },
          })
        ),
      update: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.update(args)),
      delete: (args: any) =>
        this.executeWithTenantContext(() => originalMethods.delete(args)),
      upsert: (args: any) =>
        this.executeWithTenantContext(() =>
          originalMethods.upsert({
            ...args,
            create: { ...args.create, tenant_id: this.tenantId },
          })
        ),
      count: (args?: any) =>
        this.executeWithTenantContext(() => originalMethods.count(args)),
    };
  }

  // Tenant table operations don't need tenant context (they ARE the tenants)
  get tenants() {
    return super.tenants;
  }
}

// Global Prisma client instance with connection pooling
let prisma: TenantAwarePrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new TenantAwarePrismaClient();
} else {
  // Prevent multiple instances during development hot reload
  const globalForPrisma = globalThis as unknown as {
    prisma: TenantAwarePrismaClient | undefined;
  };

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new TenantAwarePrismaClient();
  }
  prisma = globalForPrisma.prisma;
}

/**
 * Create a new tenant-aware Prisma client instance
 * Use this when you need a fresh client instance with specific tenant context
 */
export function createTenantAwarePrisma(
  tenantId?: string
): TenantAwarePrismaClient {
  const client = new TenantAwarePrismaClient();
  if (tenantId) {
    client.setTenantContext(tenantId);
  }
  return client;
}

/**
 * Get the global Prisma client instance
 * Remember to call setTenantContext() before using tenant-specific operations
 */
export default prisma;

export { TenantAwarePrismaClient };
export type { PrismaClient };

