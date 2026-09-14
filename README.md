# AppointEase

AppointEase is a full-stack smart appointment booking platform that allows patients to find providers, check real-time available slots, book appointments, and manage their appointments. Providers can manage appointments and availability, while administrators can manage the platform.

---

## Live Demo

- **Main Live Demo (Frontend)**: https://appointease-gamma.vercel.app
- **Backend API**: https://appointease-backend-jy02.onrender.com
- **GitHub Repository**: https://github.com/huzaif-87/appointease

---

## Overview

AppointEase provides a complete appointment management workflow for healthcare and professional consultation services.

The platform allows patients to search for healthcare providers, view available appointment times in real time, and book consultations instantly. Patients can track their upcoming appointments, cancel bookings, or reschedule to another time slot.

Providers have access to a specialized console where they can view scheduled appointments, update availability shifts, and manage consultation services. Platform administrators can oversee users, providers, services, and system-wide appointment schedules.

AppointEase also features an AI-powered Smart Scheduling assistant that allows users to describe their appointment needs in plain English.

---

## Key Features

### Patient
- Register and login
- Search providers and services
- View provider details
- View available appointment slots
- Book appointments
- View appointments
- Cancel appointments
- Reschedule appointments
- Receive notifications
- Receive email updates
- Manage profile

### Provider
- Provider login
- Provider dashboard
- View appointments
- Manage availability
- Manage services
- Manage profile

### Admin
- Admin login
- Dashboard overview
- Manage appointments
- Manage providers
- Manage services
- Manage availability
- Manage users
- Role-based access control

### Smart Scheduling
Users can search for appointments using natural language queries such as:

> *"I need an appointment after 5 PM this week"*

The system uses Google Gemini AI to parse the request into structured scheduling constraints. The backend then passes these constraints to the deterministic slot engine to find matching, available slots.

*AI only assists in understanding the scheduling request—the backend performs all verification and database operations.*

---

## AI Research & Usage

Google Gemini API was integrated to support natural-language appointment requests.

When a user submits a natural-language search, Gemini extracts structured parameters such as:
- Preferred time of day (morning, afternoon, evening)
- Preferred date or day range (today, tomorrow, this week)
- Specialty or service type
- Combined timing constraints

The backend validates these extracted constraints and runs them through the deterministic slot engine to calculate actual availability. This ensures that AI handles natural-language interpretation, while the backend maintains 100% accuracy for booking.

> **Important Note:**  
> The Smart Scheduling feature uses an API with limited available tokens/quota. Therefore, Smart Search usage may be limited during the live demo. If the AI service is temporarily unavailable or the API quota is reached, the application uses a safe fallback approach for supported scheduling queries.

---

## Logical Approach

The system follows a clear, structured flow:

```text
User ➔ Select Provider/Service ➔ Choose Date ➔ View Available Slots ➔ Book ➔ Confirmation
```

### Dynamic Availability Calculation

Available slots are calculated on demand using the following formula:

```text
Provider Working Hours
+ Service Duration
- Existing Active Appointments
= Real-Time Available Slots
```

### Reliability Guarantees
- **Server-Side Validation**: All inputs are checked on the server.
- **Overlap & Double-Booking Prevention**: Checks ensure a slot cannot be booked twice.
- **Idempotency Protection**: Unique request keys prevent accidental duplicate bookings.
- **Timezone Awareness**: Schedules are evaluated in configured timezones (`Asia/Kolkata`).
- **Policy Windows**: Minimum advance buffer time and cancellation/rescheduling deadlines are strictly enforced.

---

## Why These Elements Were Used

Each technology was chosen to meet specific application needs:

- **React**: Enables a fast, interactive, and responsive user interface.
- **Node.js & Express**: Provides scalable API endpoints and server-side business logic.
- **MongoDB & Mongoose**: Offers flexible data storage for users, providers, services, and bookings.
- **JWT Authentication**: Ensures secure, stateless user sessions across requests.
- **Role-Based Access Control (RBAC)**: Separates permissions for Patients, Providers, and Admins.
- **Dynamic Slot Calculation**: Calculates open slots on demand rather than storing millions of static slots.
- **Notifications & Email**: Provides instant in-app alerts and email updates to enhance user experience.
- **Google Gemini API**: Enables natural-language appointment scheduling.
- **Vercel & Render**: Delivers reliable cloud hosting for frontend and backend components.

---

## Unique Approach

The primary differentiator of AppointEase is **Smart Scheduling**.

Instead of forcing users to manually select multiple dropdown filters, users can describe their schedule preference in natural language:

> *"I need a cardiology appointment after 5 PM this week."*

The application interprets the request and returns exact, bookable time slots. Recommendations include clear explainability details, such as:
- Matches requested time
- Earliest available slot
- Verified provider availability

---

## Appointment Management

AppointEase supports complete appointment lifecycle management:

- **Booking**: Real-time reservation of available slots with idempotency protection.
- **Confirmation**: Immediate status update with booking reference generation.
- **Cancellation**: One-click cancellation subject to configured cutoff windows.
- **Rescheduling**: Move bookings to a new available slot in a single step.
- **Double-Booking Protection**: Atomic locking prevents simultaneous booking conflicts.
- **Status & History**: View upcoming, completed, and cancelled appointments.

Cancellation and rescheduling policies require requests to be submitted before the configured time-window deadline (e.g. 2 hours before appointment).

---

## Email Notifications

After a successful appointment confirmation, the registered user's email receives an appointment confirmation email.

When an appointment is successfully rescheduled, the user receives a rescheduling email.

When an appointment is successfully cancelled, the user receives a cancellation email.

> **Note:** Emails are sent after the corresponding backend operation is successfully completed.

---

## Security

- **Password Hashing**: Passwords stored using `bcryptjs` with salt rounds.
- **JWT Authentication**: Secured tokens verify user identity on protected routes.
- **Role Authorization**: Middleware restricts route access based on user role (`PATIENT`, `PROVIDER`, `ADMIN`).
- **CORS Configuration**: Restricts API access to the official Vercel deployment URL.
- **Server-Side API Keys**: Gemini API keys are kept securely on the server.
- **Environment Variables**: Sensitive configurations are loaded via environment variables.
- **Idempotency Protection**: Prevents duplicate bookings from network retries.
- **Zero Committed Secrets**: No passwords, database URIs, or private keys in source control.

---

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Axios
- React Router v6

### Backend
- Node.js
- Express.js
- MongoDB & Mongoose
- JSON Web Token (JWT)
- bcryptjs
- Nodemailer

### AI & Cloud Services
- Google Gemini API
- Vercel (Frontend Hosting)
- Render (Backend Hosting)
- MongoDB Atlas (Cloud Database)

---

## Project Structure

```text
appointease/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Application pages (Patient, Provider, Admin)
│   │   ├── services/       # API integration services
│   │   └── utils/          # Helper functions & error mappers
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node.js Express backend API
│   ├── src/
│   │   ├── config/         # Database & environment setup
│   │   ├── controllers/    # API request handlers
│   │   ├── middleware/     # Auth, RBAC, error & CORS middleware
│   │   ├── models/         # MongoDB Mongoose schemas
│   │   ├── routes/         # Express API routes
│   │   └── services/       # Email, AI & slot engine logic
│   ├── test/               # Automated test suites
│   └── package.json
├── README.md
└── .gitignore
```

---

## Testing

AppointEase includes automated test coverage for backend API logic and frontend production builds.

### Backend Automated Tests
The backend features **258 automated test scenarios across 11 test suites**:
- `cors.test.js`: Preflight OPTIONS & header permissions (7 tests)
- `api.test.js`: Core REST API endpoints (25 tests)
- `slotEngine.test.js`: Dynamic slot engine & shift boundaries (23 tests)
- `bookingEngine.test.js`: Concurrency, double-booking & idempotency (34 tests)
- `errorHandling.test.js`: Friendly error mapping & technical leak prevention (11 tests)
- `rescheduleCancellation.test.js`: Rescheduling & cancellation policy validation (32 tests)
- `smartRecommendation.test.js`: AI Smart Scheduling & fallback parsing (43 tests)
- `notifications.test.js`: Notification CRUD & email delivery isolation (36 tests)
- `criticalFixes.test.js`: Edge cases & data integrity (15 tests)
- `finalHardening.test.js`: Security & RBAC guardrails (18 tests)
- `emailAndPhoneValidation.test.js`: User input validation (14 tests)

### Frontend Build
Frontend production build completed successfully using Vite.

---

## Deployment

- **Frontend**: Hosted on **Vercel** (`client/`) ➔ https://appointease-gamma.vercel.app
- **Backend**: Hosted on **Render** (`server/`) ➔ https://appointease-backend-jy02.onrender.com
- **Database**: Cloud **MongoDB Atlas**
- **AI Service**: **Google Gemini API**
- **Email**: **Gmail SMTP / Nodemailer**

---

## Environment Variables

### Backend Variables (`server/.env`)
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `EMAIL_FROM`
- `APP_TIMEZONE`
- `CANCELLATION_WINDOW_MINUTES`
- `RESCHEDULE_WINDOW_MINUTES`
- `MIN_BOOKING_BUFFER_MINUTES`
- `CLIENT_URL`

### Frontend Variables (`client/.env`)
- `VITE_API_BASE_URL`

*Never commit `.env` files or credentials to GitHub.*

---

## Local Setup

### 1. Clone Repository
```bash
git clone https://github.com/huzaif-87/appointease.git
cd appointease
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Install Client Dependencies
```bash
cd ../client
npm install
```

### 4. Configure Environment Variables
- Create `server/.env` based on `server/.env.example`
- Create `client/.env` setting `VITE_API_BASE_URL=http://localhost:5000/api`

### 5. Start Backend Server
```bash
cd server
npm run dev
```

### 6. Start Frontend Development Server
```bash
cd client
npm run dev
```

---

## Future Improvements

- Calendar synchronization (Google Calendar / Outlook)
- Automated SMS reminders
- Integrated online payment processing
- Advanced analytics for healthcare providers
- Multi-language support for AI scheduling

---

## Recruiter Highlights

### What This Project Demonstrates
- **Full-Stack Development**: Clean separation of React frontend and Express REST API backend.
- **Database Architecture**: Relational modeling in MongoDB for users, services, providers, shifts, and bookings.
- **Authentication & RBAC**: Secure JWT authentication with role-isolated workflows for Patients, Providers, and Admins.
- **Dynamic Scheduling Logic**: Algorithmic slot generation without storing redundant database records.
- **Double-Booking Prevention**: Concurrency control preventing overlapping appointment claims.
- **AI Integration**: Server-side Gemini AI integration with fallback handling.
- **Email & Notification Engine**: In-app notifications and email updates for booking state changes.
- **Production Deployment**: Active cloud deployment on Vercel, Render, and MongoDB Atlas.
- **Automated Testing**: Comprehensive test coverage verifying system reliability.

---

## Assignment Requirements

### 1. AI Research & Usage
Google Gemini API was researched and integrated for natural-language appointment scheduling. The AI converts user scheduling requests into structured constraints, while deterministic backend logic verifies real availability.

### 2. Logical Approach
The system separates provider availability, service duration, existing appointments, and booking validation. Available slots are calculated dynamically and validated again on the server before an appointment is created.

### 3. Reason for Using the Elements
Each technology and feature was selected based on the problem it solves: React for an interactive UI, Express for APIs, MongoDB for persistent data, JWT/RBAC for security, dynamic slot calculation for accurate scheduling, and Gemini for natural-language interaction.

### 4. Unique Approach
The main unique feature is **Smart Scheduling**, where users can describe their preferred appointment time in natural language instead of manually applying multiple filters.

---

## Final Notes

AppointEase is a demonstration project built to showcase full-stack development, practical AI integration, secure appointment management, and production deployment.

> **Live Demo Note:** Smart Scheduling uses a limited API quota/token allowance in the live demo. If the quota is temporarily exhausted, the application falls back to deterministic supported scheduling logic.
