# AppointEase

Smart Appointment Booking Platform

## 1. Overview
AppointEase is an enterprise-grade healthcare appointment management platform engineered to connect patients with verified medical providers seamlessly while guaranteeing strict double-booking prevention, automated slot engine calculations, real-time availability sync, role-based access control (RBAC), and Google Gemini-powered smart scheduling search.

## 2. Live Demo
- **Frontend Application (Vercel)**: https://appointease.vercel.app
- **Backend API (Render)**: https://appointease-backend.onrender.com/api
- **API Health Check**: https://appointease-backend.onrender.com/api/health

## 3. GitHub
- **Repository**: https://github.com/huzaif-87/appointease

## 4. Key Features
- **Smart Time Recommendation**: Natural language appointment search powered server-side by Google Gemini AI.
- **Dynamic Slot Generation Engine**: Real-time conflict-free slot creation based on provider operating hours, break windows, existing appointments, and slot durations.
- **Atomic Double Booking Prevention**: Multi-layered database transaction/atomic locking guarantees zero double-booking even under concurrent race conditions.
- **Role-Based Access Control (RBAC)**: Distinct, isolated workflows and permissions for `patient`, `provider`, and `admin` roles.
- **Flexible Rescheduling & Cancellation**: Automated policy enforcement with configurable deadline windows and instant slot restoration.
- **Multi-Channel Notifications & SMTP Email**: Real-time in-app alerts alongside production Nodemailer email notifications.
- **Production Security Hardening**: Helmet HTTP headers, scoped CORS policies, granular API rate limiting, and sanitized inputs.

## 5. Patient Experience
- **Provider & Service Discovery**: Search, filter, and inspect verified medical specialists and healthcare services.
- **Interactive Booking Flow**: Select date, inspect available slots, enter visit details, review, and instantly confirm appointments.
- **Personal Dashboard**: Track upcoming and past visits, download confirmation receipts, cancel or reschedule eligible visits, and manage profile settings.
- **AI Smart Assistant**: Natural language query input (e.g., *"Cardiologist available after 5 PM this week"*) that resolves directly to matching time slots.

## 6. Provider Experience
- **Dedicated Provider Console**: Customized dashboard for doctor schedule and patient consultation management.
- **Availability Configurator**: Define weekly recurring work shifts, daily start/end times, lunch break windows, and appointment durations.
- **Appointment Management**: View scheduled appointments, review patient details, update consultation statuses, and issue status updates.

## 7. Admin Experience
- **Comprehensive Administration Suite**: Centralized dashboard for managing all system entities.
- **User & Provider Governance**: Verify doctor credentials, activate/deactivate accounts, update roles, and audit access logs.
- **Service & Slot Oversight**: Manage clinical service offerings, baseline pricing, duration parameters, and system-wide slot allocations.
- **Strict Permission Guardrails**: Unauthorized access attempts by non-admin roles trigger instant HTTP 403 Forbidden responses.

## 8. Smart Search with Gemini
- **Server-Side AI Integration**: Queries are securely processed on the Express backend via Google Gemini API—preventing key leakage.
- **Intent & Constraint Extraction**: Transforms unstructured queries into structured constraints (specialty, date ranges, time-of-day preferences).
- **Slot Engine Synthesis**: Feeds extracted constraints into the deterministic slot engine to return exact, bookable appointment slots.

## 9. Dynamic Slot Engine
- **Algorithmic Slot Calculation**: Dynamically computes open slots by segmenting doctor working windows, excluding breaks and existing bookings.
- **Timezone Awareness**: Handles shift boundaries cleanly across configurable timezones (`APP_TIMEZONE`).
- **Real-Time Buffer Enforcement**: Enforces minimum advance booking windows (`MIN_BOOKING_BUFFER_MINUTES`) to prevent immediate past-slot claims.

## 10. Double Booking Prevention
- **Database Unique Compound Index**: Enforces uniqueness on `(doctorId, startTime)` where appointment status is active.
- **Atomic Conditional Locks**: Prevents race conditions during simultaneous booking submissions via atomic MongoDB query filters.
- **Slot Availability Verification**: Pre-booking validation step checks for overlapping appointments within the target time block.

## 11. Cancellation & Rescheduling
- **Time-Window Policy Enforcement**: Cancellation and rescheduling allowed only prior to configured cutoff windows (`CANCELLATION_WINDOW_MINUTES`).
- **Instant Slot Recovery**: Immediate state updates free up canceled time blocks for other patients.
- **Audit Trails**: All status transitions log notification history and send automated status emails.

## 12. Notifications & Email
- **In-App Notification Engine**: Unread counter, status badge updates, and real-time notification drawer.
- **Production SMTP Email Delivery**: Real-time email dispatch for booking confirmations, cancellations, rescheduling, and password resets using Nodemailer.
- **Fail-Safe Async Execution**: Email service errors never crash the backend or rollback successful bookings.

## 13. Authentication & RBAC
- **JSON Web Tokens (JWT)**: Secure statetess authentication with encrypted token headers.
- **Password Hashing**: Bcryptjs with salt rounds for secure password storage.
- **Role Isolation**: Middleware (`protect`, `authorize('admin')`, `authorize('provider')`) enforces strict route access control.

## 14. Security
- **No Secret Exposure**: Zero credentials committed; all sensitive settings loaded via environment variables.
- **Scoped CORS**: Restricted in production to the specific deployed Vercel frontend URL.
- **API Rate Limiting**: Scoped rate limiters for authentication, booking, public endpoints, and AI requests.
- **Input Sanitization & Validation**: Express validators sanitize request payloads against injection attacks.

## 15. Architecture
```text
GitHub Repository
├── client/       React 18 + Vite + Tailwind CSS Frontend
└── server/       Node.js + Express Backend API

Architecture Flow:
Vercel (Frontend) ---> Render (Express Backend API) ---> MongoDB Atlas (Database)
                                |
                                +---> Google Gemini API (NLP Intent Extraction)
                                +---> Nodemailer SMTP (Email Notifications)
```

## 16. Database Design
- **User Schema**: `_name`, `email`, `password`, `role` (`patient`, `provider`, `admin`), `isVerified`, `resetPasswordToken`.
- **Doctor Schema**: `userId`, `specialty`, `qualification`, `experienceYears`, `consultationFee`, `bio`, `isVerified`.
- **Availability Schema**: `doctorId`, `dayOfWeek`, `startTime`, `endTime`, `breakStart`, `breakEnd`, `slotDurationMinutes`, `isAvailable`.
- **Appointment Schema**: `patientId`, `doctorId`, `serviceId`, `date`, `startTime`, `endTime`, `status` (`scheduled`, `completed`, `cancelled`), `notes`.
- **Notification Schema**: `userId`, `title`, `message`, `type`, `isRead`, `createdAt`.

## 17. Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Axios, React Router v6.
- **Backend**: Node.js, Express.js, Mongoose, JWT, Bcryptjs, Helmet, CORS, Express-Rate-Limit, Nodemailer.
- **Database**: MongoDB Atlas (Production), MongoDB Local (Development).
- **AI & Integrations**: Google Gemini API (`@google/genai`).
- **Hosting & CI/CD**: Vercel (Frontend), Render (Backend), GitHub (Version Control).

## 18. Testing
- **Backend Test Suite**: 100% passing test coverage across 10 test suites running via Jest & Supertest.
- **Automated Coverage**: API routes, slot engine calculations, booking race conditions, cancellation policies, RBAC enforcement, and notification triggers.
- **Frontend Build Verification**: Clean compilation using Vite with zero build or lint warnings.

## 19. Deployment
- **Frontend (Vercel)**: Configured with Root Directory `client`, build command `npm run build`, output directory `dist`, environment variable `VITE_API_BASE_URL`.
- **Backend (Render)**: Configured with Root Directory `server`, build command `npm install`, start command `npm start`, environment variables securely injected.

## 20. Environment Variables
### Server (`server/.env.example`)
```env
MONGO_URI=
JWT_SECRET=
JWT_EXPIRES_IN=30m

GEMINI_API_KEY=
GEMINI_MODEL=

EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=

APP_TIMEZONE=Asia/Kolkata

CANCELLATION_WINDOW_MINUTES=120
RESCHEDULE_WINDOW_MINUTES=120
MIN_BOOKING_BUFFER_MINUTES=30

CLIENT_URL=
```

### Client (`client/.env.example`)
```env
VITE_API_BASE_URL=https://<render-backend-url>/api
```

## 21. Local Setup
### 1. Clone Repository
```bash
git clone https://github.com/huzaif-87/appointease.git
cd appointease
```

### 2. Backend Installation & Start
```bash
cd server
npm install
cp .env.example .env
# Fill in local development environment variables
npm run dev
```

### 3. Frontend Installation & Start
```bash
cd ../client
npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:5000/api
npm run dev
```

## 22. AI Research & Usage
Google Gemini AI integration serves as a natural language scheduling assistant. Rather than relying on rigid filter forms, patients can type plain text queries. The backend extracts clinical specialty requirements, preferred times, and dates, then queries the deterministic slot engine to return precise, real-time availability.

## 23. Logical Approach
The platform separates non-deterministic AI capabilities from deterministic financial/scheduling rules:
1. **AI layer**: Handles intent extraction and parsing only.
2. **Backend engine**: Calculates slots, enforces business rules, and performs atomic database operations.
3. **Database layer**: Enforces structural uniqueness constraints, preventing race conditions regardless of concurrency.

## 24. Reason for Using Each Major Element
- **React + Vite**: Delivers lightning-fast page loading and state transitions for a smooth single-page application experience.
- **Tailwind CSS**: Enables custom, high-contrast, modern UI designs with consistent tokens and responsive utility styling.
- **Node.js + Express**: Provides asynchronous, event-driven HTTP routing with easy middleware integration.
- **MongoDB + Mongoose**: Enables flexible document modeling while providing strict schema validation and compound indexing.
- **Google Gemini**: Offers top-tier natural language processing capabilities for conversational appointment search.

## 25. Unique Approach
AppointEase guarantees zero double bookings by combining optimistic slot calculation with database-level uniqueness constraints and atomic state updates. If two users attempt to book the exact same slot simultaneously, MongoDB compound indexes reject the second transaction gracefully, guaranteeing database integrity without sacrificing performance.
