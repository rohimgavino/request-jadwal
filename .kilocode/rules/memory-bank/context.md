# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] Built schedule input app (Jadwal Kerja Karyawan) with lock feature when libur (L) > 5
- [x] Updated shift types: P (06:00), P0 (07:00), S (14:00), M (22:00), L (Libur), C (Cuti)
- [x] Changed lock logic to per-day max 5 libur (not per-employee)
- [x] Schedule data isolated per month (YYYY-MM key) — navigating months doesn't share data
- [x] Added CSV upload feature for employee names with downloadable template
- [x] Added NIK column to employee data structure (Employee type: nik, name, password)
- [x] Updated CSV upload to support NIK,Nama Karyawan two-column format
- [x] Added per-NIK login popup modal with password authentication (default password = NIK)
- [x] Updated add employee form to include NIK and password fields
- [x] Added admin special user (NIK=ADMIN, password=admin123) that can edit all rows, add/remove employees, upload CSV
- [x] Restricted per-NIK login to only edit their own row
- [x] Added C+L combined per-day lock (max 6 people with C or L on same day)
- [x] Added Export to Excel feature using xlsx library (downloads .xlsx file)
- [x] Fixed missing Upload/Export buttons by adding them to header for better visibility
- [x] Fixed upload data not persisting by adding localStorage persistence for employee data
- [x] Added password change feature - each NIK can change their own password via 🔐 button when logged in
- [x] Added auto-save for schedule data to localStorage - jadwal tersimpan otomatis per bulan
- [x] Updated edit permissions - all logged-in users (admin and regular NIK) can now edit any schedule row
- [x] Added database support with Drizzle ORM for data persistence
- [x] Migrated from localStorage to database - data now syncs across all users/computers
- [x] Fixed deploy error - replaced unavailable @kilocode/app-builder-db package with better-sqlite3

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |
| `src/db/` | Database (Drizzle + SQLite) | ✅ Ready |
| `src/actions/db.ts` | Database actions (CRUD) | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
