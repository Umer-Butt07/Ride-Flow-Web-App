# RideFlow — Ride-Hailing Web Application

RideFlow is a full-stack ride-hailing platform built with **Node.js**, **Express**, **MySQL**, and a vanilla **HTML/CSS/JS** frontend. It supports three user roles — **Rider**, **Driver**, and **Admin** — each with dedicated dashboards and real-time data powered by a live MySQL database.

---

## Prerequisites

- **MySQL 8.x** installed locally (with Event Scheduler support)
- **Node.js 18+** and npm

---

## Project Structure

```
RideFlow-Web-App/
├── backend/
│   ├── controllers/         # Business logic (auth, rider, driver, admin, reports)
│   ├── routes/              # Express route definitions
│   ├── middleware/           # JWT auth + role-based access guard
│   ├── db/                  # MySQL connection pool
│   ├── server.js            # Express app entry point
│   ├── package.json
│   └── .env                 # Database & JWT config
├── frontend/
│   ├── css/                 # Stylesheets for all pages
│   ├── js/                  # Client-side JavaScript (API-connected)
│   ├── pages/
│   │   ├── auth/            # Login & Register pages
│   │   ├── rider/           # Rider dashboard, history, payments
│   │   ├── driver/          # Driver dashboard, ride requests, earnings
│   │   └── admin/           # Admin dashboard (users, drivers, vehicles, reports)
│   └── images/              # Static assets
├── database/
│   ├── schema.sql           # Tables, constraints, indexes
│   ├── views.sql            # ActiveRidesView, TopDriversView, DriverLeaderboardView
│   ├── procedures.sql       # sp_calculate_fare, sp_complete_ride, sp_driver_earnings_summary
│   ├── triggers.sql         # 7 triggers (earnings, rating, history, promo, driver status)
│   ├── events.sql           # Scheduled events (expire promos, archive old rides)
│   ├── dcl.sql              # Role-based access control (GRANT/REVOKE)
│   ├── seed.sql             # Sample data for testing
│   └── query.sql            # 20 standalone SQL query demonstrations
└── Readme.md
```

---

## Step 1: Set Up the Database

Open MySQL Workbench (or CLI) and run these files **in order**:

```sql
-- 1. Create schema + tables + indexes
SOURCE database/schema.sql;

-- 2. Create views (ActiveRidesView, TopDriversView, DriverLeaderboardView)
SOURCE database/views.sql;

-- 3. Create stored procedures (fare calculation, ride completion, earnings summary)
SOURCE database/procedures.sql;

-- 4. Create all 7 triggers
SOURCE database/triggers.sql;

-- 5. Create MySQL event scheduler events
SOURCE database/events.sql;

-- 6. DCL — GRANT/REVOKE role-based access (run as root)
SOURCE database/dcl.sql;

-- 7. Insert seed/sample data
SOURCE database/seed.sql;
```

---

## Step 2: Configure Backend

Edit `backend/.env` and set your MySQL credentials:

```
PORT=5000
JWT_SECRET=rideflow_secret_key_2026
JWT_EXPIRES_IN=7d
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=rideflow
```

---

## Step 3: Install Dependencies & Start

```bash
cd backend
npm install
npm run dev       # development (nodemon auto-reload)
# or
npm start         # production
```

Server runs at: **http://localhost:5000**

Health check: `GET http://localhost:5000/api/health`

---

## Step 4: Open the Frontend

Open `frontend/pages/auth/login.html` using **Live Server** (VS Code extension) or any local HTTP server. The frontend communicates with the backend at `http://localhost:5000/api`.

---

## Test Credentials (from seed.sql)

All passwords are: `password123`

| Role   | Email                      |
|--------|----------------------------|
| Admin  | admin@rideflow.com         |
| Rider  | ali.rider@gmail.com        |
| Rider  | sara.rider@gmail.com       |
| Driver | usman.driver@gmail.com     |
| Driver | bilal.driver@gmail.com     |

> After login, the system automatically redirects to the correct dashboard based on role.

---

## API Overview

### Authentication (No role required)

| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| POST   | `/api/auth/register`  | Register a new user       |
| POST   | `/api/auth/login`     | Login and receive JWT     |
| GET    | `/api/auth/me`        | Get current user profile  |

### Rider Endpoints (Role: Rider)

| Method | Endpoint                        | Description                          |
|--------|---------------------------------|--------------------------------------|
| GET    | `/api/rider/dashboard`          | Dashboard stats + recent rides       |
| GET    | `/api/rider/rides/history`      | Full ride history                    |
| GET    | `/api/rider/rides/active`       | Currently active ride                |
| POST   | `/api/rider/rides/request`      | Request a new ride                   |
| POST   | `/api/rider/rides/schedule`     | Schedule a ride in advance           |
| POST   | `/api/rider/rides/:id/rate`     | Rate a driver (1–5 stars)            |
| POST   | `/api/rider/rides/:id/pay`      | Pay for a ride (Cash/Wallet/Card)    |
| POST   | `/api/rider/rides/:id/cancel`   | Cancel an active ride                |
| GET    | `/api/rider/locations`          | Get available pickup/dropoff points  |

### Driver Endpoints (Role: Driver)

| Method | Endpoint                          | Description                                |
|--------|-----------------------------------|--------------------------------------------|
| GET    | `/api/driver/dashboard`           | Dashboard stats (trips, earnings, rating)  |
| PATCH  | `/api/driver/availability`        | Toggle Online/Offline                      |
| GET    | `/api/driver/requests`            | Pending ride requests                      |
| PATCH  | `/api/driver/requests/:id/accept` | Accept a ride request                      |
| PATCH  | `/api/driver/requests/:id/reject` | Reject (auto-reassigns to next driver)     |
| GET    | `/api/driver/current-ride`        | Current active ride                        |
| PATCH  | `/api/driver/rides/:id/status`    | Update ride status (InProgress/Completed)  |
| POST   | `/api/driver/rides/:id/rate`      | Rate a rider (1–5 stars)                   |
| GET    | `/api/driver/earnings`            | Earnings summary                           |
| GET    | `/api/driver/earnings/history`    | Detailed earnings per ride                 |
| GET    | `/api/driver/rides/history`       | Completed ride history                     |
| GET    | `/api/driver/profile`             | Full driver profile with vehicle info      |
| POST   | `/api/driver/vehicles`            | Register a new vehicle                     |
| GET    | `/api/driver/vehicles`            | List all registered vehicles               |
| POST   | `/api/driver/payout`              | Request wallet payout                      |

### Admin Endpoints (Role: Admin)

| Method | Endpoint                          | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/admin/dashboard`            | Platform-wide stats                  |
| GET    | `/api/admin/users`                | List all users (filter by role/status) |
| PATCH  | `/api/admin/users/:id/status`     | Suspend / Ban / Activate a user      |
| GET    | `/api/admin/drivers`              | List all drivers with details        |
| PATCH  | `/api/admin/drivers/:id/verify`   | Verify / Reject a driver             |
| GET    | `/api/admin/vehicles`             | List all registered vehicles         |
| GET    | `/api/admin/complaints`           | List all complaints                  |
| PATCH  | `/api/admin/complaints/:id`       | Resolve a complaint                  |
| GET    | `/api/admin/promos`               | List promo codes                     |
| POST   | `/api/admin/promos`               | Create a new promo code              |
| DELETE | `/api/admin/promos/:id`           | Deactivate a promo code              |

### Reports Endpoints (Role: Admin)

| Method | Endpoint                            | Description                              |
|--------|-------------------------------------|------------------------------------------|
| GET    | `/api/reports/rider-rides`          | Completed rides for a rider              |
| GET    | `/api/reports/drivers-by-city`      | Drivers in a city ordered by rating      |
| GET    | `/api/reports/revenue-by-city`      | Total revenue per city (SUM)             |
| GET    | `/api/reports/revenue-by-city-date` | Revenue by city + date range             |
| GET    | `/api/reports/revenue-by-payment`   | Revenue breakdown by payment method      |
| GET    | `/api/reports/low-rated-drivers`    | Drivers with AVG rating < 3.5 (HAVING)   |
| GET    | `/api/reports/trips-per-driver`     | Trip count per driver (COUNT)            |
| GET    | `/api/reports/full-trip-report`     | Full trip report (INNER JOIN)            |
| GET    | `/api/reports/all-riders`           | All riders incl. no rides (LEFT JOIN)    |
| GET    | `/api/reports/promo-usage`          | Promo code usage per ride (JOIN)         |
| GET    | `/api/reports/driver-earnings`      | Driver earnings & commissions            |
| GET    | `/api/reports/refunds`              | Refund & dispute totals                  |
| GET    | `/api/reports/active-rides`         | Active rides (from View)                 |
| GET    | `/api/reports/top-drivers`          | Top drivers (from View)                  |
| GET    | `/api/reports/leaderboard`          | Driver leaderboard by city               |

---

## Database Concepts Implemented

### 1. Basic SQL Queries
- `SELECT`, `WHERE`, `ORDER BY` across all controllers
- Completed rides for a specific rider ordered by date
- Drivers in a city ordered by rating
- 20 standalone query demonstrations in `query.sql`

### 2. Aggregate Functions & HAVING Clause
- `SUM()` — Total revenue per city
- `AVG()` — Average driver ratings with `HAVING AVG(Score) < 3.5`
- `COUNT()` — Trips completed per driver
- `GROUP BY` with proper aggregate grouping

### 3. JOINs for Reports
- `INNER JOIN` — Full trip report linking Riders, Rides, Drivers, Vehicles, Locations, Payments
- `LEFT JOIN` — All riders including those with zero completed rides
- `JOIN` on Payments + Promo_Codes — Discount usage displayed per ride
- Proper column aliasing and ordering throughout

### 4. Views, Indexes & Stored Procedures
- **Views**: `ActiveRidesView`, `TopDriversView`, `DriverLeaderboardView`
- **Indexes**: On `RiderID`, `DriverID`, `Status`, `City`, `RequestStatus`, `PaymentStatus`
- **Stored Procedures**: `sp_calculate_fare` (with surge pricing), `sp_complete_ride`, `sp_driver_earnings_summary`

### 5. Triggers & Events
| Trigger | Description |
|---------|-------------|
| `trg_ride_to_history` | Archives ride to Ride_History on Completed/Cancelled |
| `trg_update_driver_rating` | Recalculates driver AvgRating on new rating |
| `trg_driver_earnings` | Creates earning record + credits wallet on completion |
| `trg_flag_low_rating` | Suspends drivers (< 3.5) and riders (< 3.0) |
| `trg_payment_to_ride_completed` | Auto-completes ride when payment is Paid |
| `trg_promo_usage_count` | Increments promo UsageCount when applied |
| `trg_driver_on_trip` | Sets driver to OnTrip/Online based on ride status |

| Event | Description |
|-------|-------------|
| `evt_expire_promos` | Deactivates expired promo codes every midnight |
| `evt_archive_old_rides` | Archives rides older than 30 days nightly |

### 6. Hierarchical User Access (DCL)
- `rider_role` — SELECT + INSERT on Rides, Payments, Ratings, Ride_Requests
- `driver_role` — SELECT + UPDATE on Rides, Ride_Requests, Drivers
- `support_role` — SELECT all + UPDATE Complaints, REVOKE DELETE
- `admin_role` — ALL PRIVILEGES on all tables
- Application DB users: `rideflow_app` (rider+driver+support), `rideflow_admin` (admin)

### 7. User Interface
- **Rider Dashboard**: Book rides, view ride history, manage wallet, rate drivers
- **Driver Dashboard**: Toggle online/offline, accept/reject rides, view earnings, rate riders
- **Admin Panel**: Manage users, drivers, vehicles, complaints, promo codes, and view live reports
- **Role-based login**: JWT authentication with automatic redirect to correct dashboard
- **Live data**: All UI connected to MySQL via REST API (no hardcoded/mock data)

---

## Key Features

- 🔐 **JWT Authentication** with role-based access control
- 🚗 **Real-time ride matching** — assigns best available verified driver
- 🔄 **Auto-reassign** — rejected rides automatically move to next driver
- 📅 **Scheduled rides** — riders can book rides in advance
- 💰 **Fare calculation** — stored procedure with surge pricing during peak hours
- 🎟️ **Promo codes** — apply discounts with validation and usage limits
- ⭐ **Mutual ratings** — both riders and drivers rate each other (1–5 stars)
- 🚨 **Auto-flagging** — low-rated drivers/riders get automatically suspended
- 💳 **Multiple payment methods** — Cash, Wallet, Card
- 💸 **Driver payouts** — earnings credited to wallet, withdrawable via payout
- 📊 **Live analytics** — revenue, earnings, leaderboard reports in Admin panel
- 📋 **Complaint management** — file and resolve complaints with admin oversight