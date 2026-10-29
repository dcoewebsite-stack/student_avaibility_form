# IISc D-CoE — Student Availability & Gamified Workshop Preference Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon.tech-00E599?logo=postgresql)](https://neon.tech/)
[![Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

A gamified workshop preference and scheduling platform engineered for the **Design Centre of Excellence (D-CoE)** at the **Indian Institute of Science (IISc), Bangalore**. 

It enables participants to express interest, select preferred 5-day workshop batch dates, log previously completed modules towards their PG Certificate, earn redeemable community points, and invite peers via referral links. The platform includes a dedicated organizer admin dashboard with batch date clustering and single-sheet data views.

---

## 🌟 Key Features

### 1. Interactive 4-Step Preference Journey
- **Step 0 — Gamification Overview**: Welcomes learners with real-time points breakdown (+10 pts start bonus).
- **Step 1 — The 8 D-CoE Modules**: Select interested modules or mark already-completed ones. Real-time tagline countdown tracks remaining modules needed to unlock the D-CoE PG Certificate.
- **Step 2 — Smart 5-Day Monday-to-Friday Batch Selector**:
  - Dynamically calculates exact 5-day workshop schedules (e.g., `14 Dec 2026 → 18 Dec 2026`).
  - Allows primary (1st choice) and alternative (2nd choice) batch date selections for each module.
  - Automatically identifies and skips date selection for already-completed modules.
- **Step 3 — Mandatory Profile & Contact Details**:
  - Requires **First Name**, **Email Address**, **WhatsApp Phone Number**, **College / Organization**, and **City**.
  - Optional **Referral Code** input (`DCOE-XXXXXX`) granting an immediate +25 pts welcome bonus.
  - Attendance mode preference (In-Person at IISc Campus vs. Online).
- **Step 4 — Referral & Rewards Hub**:
  - Displays points earned, achievement badges (*Explorer*, *Pathfinder*, *Community Builder*).
  - Unlocks merchandise redemption (D-CoE Key Ring, Swag Kit, Workshop Waivers).
  - Generates personal invite code and 1-click WhatsApp share links.
  - Live log of friends who registered with your code and points earned from each referral.

### 2. Returning Participant Quick-Check
- **"Already Registered? Check Points"**: Returning students can enter their registered email at any time to view their updated points, track friends referred, and claim newly unlocked rewards without submitting duplicate records.

### 3. Organizer Admin Dashboard (`/admin`)
- **8-Module Breakdown**: Visual cards showing total registrations per module. Clicking any module displays student date preferences.
- **Batch Clustering Filter**: Groups students by their chosen 5-day week to help coordinators finalize batch schedules and lab capacities.
- **Master Consolidated Sheet**: View all participant data in a single unified table (`v_master_registrations`): Student details, total points, rewards claimed, modules completed, and dates chosen.
- **One-Click CSV Export**: Download student lists with preferred and alternative dates for spreadsheet reporting.

### 4. Enterprise Integrations & Resilience
- **Neon Cloud PostgreSQL**: Serverless PostgreSQL with connection pooling.
- **Pre-Configured SQL Views**:
  - `v_master_registrations`: Consolidated row per participant.
  - `v_module_preferences`: Unrolled student module choices with dates.
  - `v_keyring_manual_collections` & `v_all_claimed_rewards`: Reward fulfillment tracking.
- **Resilient Zoho CRM Sync**: Queues and pushes leads, contact details, attendance preferences, and module interests to Zoho CRM.

---

## 🏗️ The 8 D-CoE Innovation Modules

1. **Module #1: Industry 4.0 Technologies** (IoT, AI, automation & smart systems — 5-day hands-on)
2. **Module #2: Design Thinking & Methodology** (Human-centred problem solving — 5-day hands-on)
3. **Module #3: Ergonomics & Human Factors** (Design for people, safety & comfort — 5-day hands-on)
4. **Module #4: Aesthetics & Semiotics** (Visual language & product meaning — 5-day hands-on)
5. **Module #5: Design Prototyping** (Rapid prototyping & iteration — 5-day hands-on)
6. **Module #6: Mechanical Prototyping** (Hands-on fabrication & machining — 5-day hands-on)
7. **Module #7: Electronic Prototyping** (Circuits, sensors & embedded systems — 5-day hands-on)
8. **Module #8: Business Development & Innovation** (From idea to venture — 5-day hands-on)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18.x or v20.x
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A free cloud PostgreSQL instance from [Neon.tech](https://neon.tech)

### 1. Clone & Install
```bash
git clone https://github.com/dcoewebsite-stack/Student_Avaibility_form.git
cd Student_Avaibility_form
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Neon.tech Cloud PostgreSQL Connection String (Use the pooled connection string)
DATABASE_URL="postgresql://neondb_owner:<password>@ep-xxxx-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Base Domain for Dynamic Referral URLs (Optional in dev, recommended in production)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Zoho CRM Configuration (Optional)
ZOHO_CLIENT_ID="your_zoho_client_id"
ZOHO_CLIENT_SECRET="your_zoho_client_secret"
ZOHO_REFRESH_TOKEN="your_zoho_refresh_token"
ZOHO_API_DOMAIN="https://www.zohoapis.com"
ZOHO_ACCOUNTS_DOMAIN="https://accounts.zoho.com"
```

### 3. Run Database Migrations
Initialize the database tables, views, and reward seed data:
```bash
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.  
To access the Admin Dashboard, navigate to **[http://localhost:3000/admin](http://localhost:3000/admin)**.

---

## 🌐 Deploying to Vercel

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and import the repository.
3. In **Settings → Environment Variables**, add:
   - `DATABASE_URL`: Your pooled Neon connection string (`postgresql://neondb_owner:...`).
   - `NEXT_PUBLIC_APP_URL`: Your live domain (e.g. `https://your-project.vercel.app`).
   - (Optional) `ZOHO_*` credentials if syncing with CRM.
4. Click **Deploy**.
5. Once deployed, verify both the main form (`/`) and the admin view (`/admin`).

---

## 📁 Project Structure

```
├── db/
│   ├── schema.sql           # 13 relational tables & consolidated reporting views
│   └── seed.sql             # Form missions, point thresholds, and rewards
├── scripts/
│   ├── run-schema.js        # Automated migration runner
│   ├── create-views.js      # Dedicated view generator
│   └── view-claims.js       # CLI helper to inspect claimed rewards
├── src/
│   ├── app/
│   │   ├── admin/           # Organizer Admin Dashboard page
│   │   ├── api/
│   │   │   ├── admin/       # Endpoints for master sheet and module clustering
│   │   │   ├── forms/       # Form submission, validation & points calculation
│   │   │   ├── rewards/     # Reward claim & inventory verification
│   │   │   └── user/        # Returning participant points & referral status lookup
│   │   ├── globals.css      # Custom styles and animations
│   │   ├── layout.tsx       # Root Next.js layout
│   │   └── page.tsx         # 4-Step interactive gamified preference form
│   └── lib/
│       ├── db.ts            # PostgreSQL pool configuration with auto SSL & sanitization
│       └── zoho.ts          # Resilient Zoho CRM sync utility
└── public/
    └── dcoe-poster.jpg      # High-resolution social media graphic poster
```

---

## 🛡️ License & Acknowledgements

Created for the **Design Centre of Excellence (D-CoE)** at the **Indian Institute of Science (IISc)**.  
All rights reserved.

