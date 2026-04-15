# PoultryManager.io — Project Vision

## Overview

**PoultryManager.io** is a centralized SaaS platform designed to cover every aspect of the poultry industry — from hatchery and broiler raising to egg production, slaughterhouse operations, marketing, sales, and equipment trading. The goal is to become the mega-hub for all poultry stakeholders, delivering purpose-built management tools to each segment of the value chain.

---

## Strategic Context

### ADAFSA Partnership

The platform is planned to be potentially backed by the **Abu Dhabi Agriculture & Food Safety Authority (ADAFSA)**, positioning it as the mandated industry standard for the UAE poultry sector. With the entire industry operating on a single platform, ADAFSA gains real-time visibility into local production volumes, health compliance, and supply chain integrity — directly enhancing food security oversight and development planning.

### Developer Background

- **Estera Farms** — 3+ years of hands-on experience raising chickens in the UAE, providing deep domain knowledge of the day-to-day operational challenges in poultry management.
- **Estera Tech LLC** — A technology company specializing in management CRMs and business software, bringing the engineering capability to build production-grade SaaS.

This combination of domain expertise and technical capability is the foundation of PoultryManager.

---

## Module Roadmap

| Module | Stakeholders | Status |
|--------|-------------|--------|
| **Broiler Management** | Broiler farms, farm managers, workers | **V1 — Active Development** |
| Hatchery Management | Hatcheries, breeders | Planned |
| Free-Range Chicken Management | Free-range farms | Planned |
| Egg Production Management | Layer farms, egg distributors | Planned |
| Slaughterhouse Operations | Processing plants, inspectors | Planned |
| Marketing & Sales | Distributors, retailers, wholesalers | Planned |
| Equipment Trading | Equipment suppliers, farms | Planned |
| ADAFSA Oversight & Reporting | Regulatory authority | Planned |

Users register and subscribe to the modules relevant to their operations. A single user may subscribe to multiple modules.

---

## V1 Scope: Broiler Management

The first release focuses exclusively on broiler chicken raising — validated by years of real-world use through an existing AppSheet-based app at Estera Farms.

### V1 Features

- **Batch Management** — Create and track chicken batches (breed, quantity, source, placement date)
- **Cycle Management** — Full growth cycle tracking from day-old chick to market-ready (typically 35–45 days)
- **Farm Management** — Farm profiles, sheds/houses, capacity planning, environmental conditions
- **Labour Management** — Worker profiles, assignments, schedules, role-based access per farm
- **Health & Medicine** — Vaccination schedules, medication tracking, mortality logging, veterinary notes
- **Sales & Invoicing** — Sell batches/birds, generate invoices, payment tracking
- **Dashboard & KPIs** — Mortality rate, FCR (Feed Conversion Ratio), growth curves, revenue, active batch overview

---

## User Model

- All registrants are classified as **Users**
- Users select which **modules** they want access to during registration
- Module access will be gated by **Stripe subscriptions** (to be implemented later — free access during development)
- **Business licensing and documentation** collection will be added to the registration flow in a future phase
- Missed subscription payments will suspend module access

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | MERN (MongoDB, Express, React, Node.js) | Proven full-stack JS, fast iteration |
| Frontend | React + Vite + Tailwind + shadcn/ui | Modern DX, accessible components, utility CSS |
| File Extensions | `.js` only (no `.jsx` / `.tsx`) | Simpler to manage |
| State | Zustand (client) + React Query (server) | Lightweight, separation of concerns |
| Auth | JWT in httpOnly cookies | Secure, stateless |
| i18n | i18next with RTL support | English-first, Arabic and other languages ready |
| Deletion | Soft deletes (`deletedAt` timestamp) | Preserves referential integrity, enables recovery |
| Deployment | Vercel (serverless) | Zero-ops, auto-scaling |
| Database | MongoDB Atlas | Serverless-compatible, flexible schema |
| Multi-tenancy | None (single domain) | Not needed for V1 |
| Mobile | Mobile-first responsive web, React Native later | Web validates the product first |

---

## Data Deletion Policy — Soft Deletes

All primary entities use **soft deletes**. Records are never physically removed from the database — instead, a `deletedAt` timestamp is set when the user triggers a delete action.

### Why soft deletes

- **Referential integrity** — Foreign key references between entities (Worker → Contact, Farm → Business) are never broken. Historical links remain intact for audit trails, analytics, and future data recovery features.
- **Data preservation** — Accidental deletions can be reversed at the database level. Production data is never irretrievably lost from a user action.
- **Future features** — Enables "trash / archive" UI, undo functionality, and admin-level data recovery without schema changes.

### Affected models

| Model | Cascade behavior on delete |
|-------|---------------------------|
| **Worker** | Soft-deletes the linked Contact |
| **Contact** | Soft-deletes all linked Workers |
| **Farm** | Soft-deleted independently (Business is preserved) |
| **Business** | Soft-deleted independently |

### Implementation rules

1. Every model has a `deletedAt` field (`Date`, default `null`).
2. **All GET routes** filter with `deletedAt: null` — soft-deleted records are invisible to the API and frontend.
3. **All PUT routes** include `deletedAt: null` in their lookup — you cannot edit a deleted record.
4. **DELETE routes** set `deletedAt: new Date()` instead of calling `findByIdAndDelete`.
5. Cascade soft-deletes share the **same timestamp** so they can be reversed as a group.
6. **Media files in S3 are not deleted** — they remain in storage and are still referenced by their `Media` documents. This preserves uploaded documents and images for potential recovery.
7. New records created via POST are unaffected — `deletedAt` defaults to `null`.

### What is NOT soft-deleted

- **Media documents** — The `Media` collection and S3 objects are never soft-deleted. Files persist in storage indefinitely. A future cleanup job may purge orphaned media for soft-deleted entities after a retention period.
- **User accounts** — Account deletion is out of scope for V1 and would follow a separate policy.

---

## Design Principles

- **Mobile-first** — The majority of farm workers and managers will access the app from phones on-site
- **RTL-ready** — Arabic is a primary language for UAE users; `dir` attribute and layout must support RTL from day one
- **Dark & light mode** — Full theme support with CSS variables and class-based toggling
- **Institutional green theme** — Professional, agricultural, government-grade aesthetic befitting an ADAFSA-backed tool

---

## Future Plans

- **Stripe Integration** — Monthly subscription billing per module
- **React Native App** — Standalone mobile application built from the web version
- **Business Licensing** — Collect and verify trade licenses and regulatory documents during registration
- **Multi-language Support** — Arabic, Hindi, Urdu, Bengali, and other languages common in the UAE workforce (infrastructure already in place via i18next)
- **ADAFSA Dashboard** — Regulatory oversight views with aggregated production data across all registered farms
- **Cloudinary / S3 Storage** — Media uploads for farm photos, documents, invoices
