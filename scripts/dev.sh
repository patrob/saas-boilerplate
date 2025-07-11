#!/bin/bash

# SaaS Boilerplate Development Setup Script
# This script sets up the local development environment with fresh data

set -e

echo "🚀 Setting up SaaS Boilerplate development environment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📋 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your Clerk API keys before running the app"
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down -v --remove-orphans 2>/dev/null || true

# Start fresh containers
echo "🐳 Starting fresh Docker containers..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if migrations ran successfully
echo "✅ Checking database migration status..."
if docker compose logs flyway | grep -q "Successfully applied"; then
    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  Database migrations may have failed. Check logs with: docker compose logs flyway"
fi

# Check if Prisma generation completed
echo "✅ Checking Prisma type generation..."
if docker compose logs prisma-generate | grep -q "Generated Prisma Client"; then
    echo "✅ Prisma types generated successfully"
else
    echo "⚠️  Prisma type generation may have failed. Trying local generation..."
    echo "📦 Running Prisma generation locally..."
    
    # Try to generate Prisma client locally
    if command -v npx >/dev/null 2>&1; then
        export DATABASE_URL="postgresql://saas_user:saas_password@localhost:5432/saas_db"
        npx prisma db pull --schema=./database/schema.prisma
        npx prisma generate --schema=./database/schema.prisma
        echo "✅ Prisma types generated locally"
    else
        echo "⚠️  npx not found. Please run 'npm install' and then 'npm run db:generate'"
    fi
fi

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your Clerk API keys"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to see your app"
echo ""
echo "Useful commands:"
echo "  npm run docker:fresh  - Restart with fresh data"
echo "  npm run docker:down   - Stop all containers"
echo "  npm run db:generate   - Regenerate Prisma types"
echo ""
