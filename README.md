# WOMS Backend - Work Order Management System

Backend API for Parking servis Herceg Novi's Work Order Management System.

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

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/woms_db
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
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

## API Endpoints

### Authentication

#### POST `/api/auth/register`
Register a new user (Admin only in production)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+382 67 123 456",
  "role": "WORKER"
}
```

#### POST `/api/auth/login`
Login with email and password

**Request:**
```json
{
  "email": "admin@parkingservis.me",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@parkingservis.me",
      "firstName": "Admin",
      "lastName": "User",
      "role": "ADMINISTRATOR"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

#### GET `/api/auth/profile`
Get current user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <access-token>
```

## Database Schema

### User Roles

- **ADMINISTRATOR** - Full system access
- **MANAGER** - Create/assign orders, view reports
- **WORKER** - View assigned orders, update status

### Main Models

- **User** - System users with role-based access
- **WorkOrder** - Main work orders
- **WorkOrderStatusHistory** - Track status changes
- **Attachment** - Photos/documents for work orders
- **Comment** - Internal communication
- **TimeLog** - Productivity tracking
- **Notification** - System notifications

## Default Users (Seeded)

After running `pnpm prisma:seed`:

| Role          | Email                      | Password    |
|---------------|----------------------------|-------------|
| Administrator | admin@parkingservis.me     | admin123    |
| Manager       | manager@parkingservis.me   | manager123  |
| Worker        | worker1@parkingservis.me   | worker123   |
| Worker        | worker2@parkingservis.me   | worker123   |

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration history
│   └── seed.ts               # Initial data seeding
├── src/
│   ├── config/
│   │   └── database.ts       # Prisma client config
│   ├── controllers/
│   │   └── authController.ts # Auth endpoints
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts   # Global error handling
│   │   └── validation.ts     # Request validation
│   ├── routes/
│   │   └── authRoutes.ts     # Auth routes
│   ├── services/
│   │   └── authService.ts    # Auth business logic
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── utils/
│   │   ├── ApiError.ts       # Error classes
│   │   ├── jwt.ts            # JWT utilities
│   │   └── passwordHash.ts   # Password utilities
│   ├── app.ts                # Express app setup
│   └── index.ts              # Server entry point
├── .env                      # Environment variables
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

## Next Steps

- [ ] User management endpoints (CRUD)
- [ ] Work order management endpoints
- [ ] File upload functionality
- [ ] Notification system
- [ ] Reporting endpoints
- [ ] Email notifications
- [ ] WebSocket for real-time updates (optional)
