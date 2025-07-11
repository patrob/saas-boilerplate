# SaaS Boilerplate Project Brief

## Project Overview

A modern B2C SaaS boilerplate built with Next.js 14, TypeScript, and Azure, designed for rapid prototyping and production deployment of scalable multi-tenant applications.

## Target Audience

- **Primary:** Developers building B2C SaaS applications
- **Secondary:** Consumers using the SaaS products built with this boilerplate
- **Tertiary:** Small teams and solo developers needing rapid prototyping

## Core Goals

1. **Rapid Prototyping:** Get from idea to MVP in days, not weeks
2. **Production Ready:** Battle-tested architecture with proper scaling patterns
3. **Cost Efficient:** Leverage free-tier services and optimized resource sharing
4. **Developer Experience:** Clear documentation, type safety, and modern tooling
5. **Multi-tenant Foundation:** Built-in tenant isolation and scaling patterns

## Key Requirements

### Technical Stack

- **Frontend:** Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Authentication:** Clerk with direct signup flow (Option A)
- **Database:** PostgreSQL with Flyway migrations and Prisma client
- **Infrastructure:** Azure Static Web Apps with global CDN
- **Local Development:** Docker Compose with fresh data on each run

### Business Model Focus

- **B2C SaaS:** Consumer-focused with social login and simplified onboarding
- **Freemium Ready:** Support for free tier users and paid subscriptions
- **Global Scale:** Multi-region deployment with GDPR/CCPA compliance
- **Usage-based Billing:** Metering and subscription management integration

### Architecture Principles

- **Multi-tenant:** Shared infrastructure with logical isolation using PostgreSQL RLS
- **Scalable:** Horizontal scaling patterns and deployment stamps
- **Secure:** Tenant isolation, input validation, and compliance-ready
- **Observable:** Monitoring, logging, and performance tracking

## Success Criteria

- [ ] Complete multi-tenant authentication and data isolation
- [ ] Docker Compose local development with fresh data
- [ ] Flyway SQL migrations with Prisma type generation
- [ ] Clerk authentication with social login
- [ ] Production-ready Azure deployment
- [ ] Comprehensive documentation and examples
- [ ] Test coverage > 80%
- [ ] Lighthouse score > 90

