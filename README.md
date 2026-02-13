Backend API for Parking servis Herceg Novi's Work Order Management System

## Tech Stack

- **Node.js** with **Express.js** - REST API framework
- **TypeScript** - Type-safe development
- **PostgreSQL** - Relational database
- **Prisma** - ORM and database toolkit
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Seed initial data
pnpm prisma:seed
```

### Development

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Open Prisma Studio (database GUI)
pnpm prisma:studio
```
