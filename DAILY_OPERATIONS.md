# Daily Operations & House Management — Design Document

> Architecture and phased implementation plan for the house-level daily data collection system, configurable worker checklists, weight sampling, role-based field access, and the analytics foundation. Extracted from a design session exploring how to digitize the physical daily tracking sheets used at Estera Farms.

---

## Context

Poultry farms track daily statistics per house on physical paper forms: deaths, feed bags consumed, water consumption, temperature, and periodic weight samples. This data is the operational heartbeat — everything downstream (FCR, mortality curves, growth tracking, cost analysis, alerts) derives from it.

The current data model has the business/financial layer (Sources, Feed Orders, Expenses, Sale Orders) but no operational telemetry layer. This document defines that layer.

### Physical Form Structure (Estera Farms)

The paper tracking sheet is organized as:
- **Header:** Farm name, House #, Arrival Date, Initial bird count
- **Grid:** 5 weeks × 7 days = 35 days (one full broiler cycle)
- **Columns:** Each day has AM and PM sub-columns
- **Rows per day:** Date, Deaths, Feed (bags), Water (liters), Weight (periodic)
- **Weekly totals** column at the end of each week row

---

## Core Architectural Changes

### 1. Farm → House Hierarchy

The current `Farm` model has a flat `totalCapacity` field and `Batch` links directly to `Farm`. In reality, operations happen at the **house level** — each house is a physically separate building with its own bird population, its own daily readings, and its own capacity.

**Change:** Replace `Farm.totalCapacity` with a separate `House` model. Total farm capacity becomes a computed sum of all house capacities.

#### House Model

```
House {
  _id             ObjectId
  user_id         → User          owner
  createdBy       → User
  farm            → Farm          parent farm
  name            String          "House A", "Shed 1", etc.
  capacity        Number          max birds this house can hold
  sortOrder       Number          display ordering in UI
  isActive        Boolean         can deactivate without deleting
  deletedAt       Date|null       soft delete
  timestamps      auto
}
```

**Indexes:** `{ user_id: 1, farm: 1 }`

#### Farm Model Changes

- Remove `totalCapacity` field
- Total capacity is computed by summing `House.capacity` where `farm == this._id && deletedAt == null`
- The Add Farm / Edit Farm forms get a **House Configurator** — a repeatable section where the user defines each house with a name and capacity
- A computed total is displayed at the bottom

#### House Configurator UX (Farm Form)

```
Houses
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  House 1:  Name [ House A ]  Capacity [ 3000 ]  [🗑️]
  House 2:  Name [ House B ]  Capacity [ 5000 ]  [🗑️]
  House 3:  Name [ House C ]  Capacity [ 3000 ]  [🗑️]

  [+ Add House]

  Total Farm Capacity: 11,000 birds (computed)
```

On mobile: stacked card layout, each house is a card with two fields. Intuitive, minimal.

---

### 2. Batch ↔ House Relationship

When creating a batch, the user selects a farm, then picks which houses this batch will occupy and specifies the actual bird count per house.

**Change:** Add a `houses` embedded array on the `Batch` model.

#### Batch Model Changes

Add to `Batch`:

```
houses: [
  {
    house         → House (ObjectId)
    quantity      Number            actual birds placed in this house
  }
]
```

- Houses currently occupied by an active batch show as locked/unavailable in the batch creation form
- A batch can span multiple houses (common for large batches)
- Each house can only have one active batch at a time
- The batch creation form shows house capacity alongside the quantity input for reference

#### Batch Creation UX

```
New Batch
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Farm:    [ Estera Farm ▾ ]

  Select Houses:
  ☑ House A (3,000 cap)    Quantity: [ 3000 ]
  ☑ House B (5,000 cap)    Quantity: [ 4800 ]
  ☐ House C (3,000 cap)  — 🔒 In use by Batch #11

  Total birds: 7,800
  Start date: [ Apr 13, 2026 ]
```

---

### 3. Worker Accounts & Role-Based Field Access

Workers need the ability to log into the system to submit daily data. The existing `Worker` model tracks worker records in a directory — this extends to give them actual system access.

#### Auth Options

- **PIN login** (primary for field workers): 4-6 digit numeric PIN, big button keypad, no keyboard needed. Optimized for low-tech-savvy users.
- **Username/password** (optional): Standard auth for supervisors, owners, vets who prefer it.

#### Worker Model Changes

Add to `Worker`:

```
pin               String|null       hashed 4-6 digit PIN for quick auth
linkedUser        → User            (already exists) — link to a User account for full auth
houseAssignments  [→ House]         which houses this worker is responsible for
```

When a worker authenticates via PIN, the system resolves which `Worker` record they are, and from that determines their `role` and `houseAssignments`.

#### Role Permissions (Field Operations)

| Role | Can Submit Daily Logs | Can Approve Logs | Can Edit After Submit | Can Do Weight Sampling | Can Configure Protocols | Can View Analytics |
|------|----------------------|------------------|----------------------|----------------------|------------------------|-------------------|
| **Labourer** | ✅ (assigned houses only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Supervisor** | ✅ (all farm houses) | ✅ | ✅ (same day) | ✅ | ❌ | ✅ (farm level) |
| **Veterinarian** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ (health data) |
| **Manager/Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (full) |

Add `'veterinarian'` to the `Worker.role` enum: `['manager', 'supervisor', 'labourer', 'driver', 'veterinarian', 'other']`.

---

## Daily Log — Unified Model (V1 Simplified)

> **Note:** The Protocol Engine (configurable checklists), status workflow (DRAFT/SUBMITTED/APPROVED/OVERDUE), deadline system, modification audit trail, and separate WeightSample model described in earlier design sessions have been **deferred to a later phase**. V1 implements direct data entry from the admin panel using a unified model with three log types.

### DailyLog Model

A single model handles all three entry types — daily operations, weight sampling, and environmental monitoring. The `logType` discriminator determines which fields are relevant.

```
DailyLog {
  _id             ObjectId
  user_id         → User            farm owner (multi-tenant scoping)
  createdBy       → User            who created this entry
  updatedBy       → User            who last modified this entry
  batch           → Batch
  house           → House
  date            Date              calendar date (YYYY-MM-DD)
  cycleDay        Number            auto-computed: (date - batch.startDate) + 1
  logType         Enum              'DAILY' | 'WEIGHT' | 'ENVIRONMENT'

  // DAILY fields
  deaths          Number|null       bird deaths for the day
  feedKg          Number|null       kg of feed consumed
  waterLiters     Number|null       liters of water consumed

  // WEIGHT fields
  averageWeight   Number|null       average weight in grams

  // ENVIRONMENT fields
  temperature     Number|null       degrees Celsius
  humidity        Number|null       percentage (0-100)
  waterTDS        Number|null       TDS reading in ppm
  waterPH         Number|null       pH reading (0-14)

  // Shared
  notes           String|null
  photos          [→ Media]         evidence photos (array of ObjectIds)
  deletedAt       Date|null         soft delete

  timestamps      auto (createdAt, updatedAt)
}
```

**Indexes:**
- `{ user_id: 1, batch: 1, house: 1, date: 1, logType: 1 }` (unique compound — one entry per type per house per day)
- `{ batch: 1, house: 1 }` (for querying all logs for a house in a batch)

### Unique Constraint

One entry per `{ batch, house, date, logType }`. When a user creates an entry for the same combination, the existing entry is loaded for editing (upsert behavior).

### CycleDay Computation

Stored on the document for offline availability. Computed on save: `cycleDay = daysBetween(batch.startDate, date) + 1`. Recomputed if date changes.

### Date Validation

The entry date must be `>= batch.startDate`. Users cannot create logs for dates before the batch cycle began.

### UI: Operations Tab (Batch Detail)

The batch detail page gains a new **Operations** tab alongside the existing **Overview** tab. The Operations tab shows:

- Each house as a collapsible section
- Within each house: entries grouped by date (most recent first)
- Under each date: log entry cards showing type badge, key data summary, who entered it, and timestamps
- "+Add" per house opens a side sheet form
- The form uses a log type toggle (EnumButtonSelect with icons) for progressive disclosure of type-specific fields

---

## Worker Mobile Experience

### Design Principles

- **One-thumb operable.** Workers may be holding equipment, wearing gloves, or in dirty conditions.
- **No menus, no navigation complexity.** One flow: tap house → complete tasks → submit.
- **Big touch targets.** Minimum 48px tap areas. Large number inputs.
- **Color-coded status.** Instant visual feedback without reading text.
- **Offline-first.** All data entry works without connectivity. Syncs when back online.
- **PIN-first auth.** Big digit buttons, no keyboard.

### Worker Home Screen

```
Good morning, Ahmed                       Day 14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟡 House A                          ⏱️ Due in 6h
   3 of 6 tasks done

🟢 House B                          ✓ Submitted
   6 of 6 tasks done

🔴 House C                          ⚠️ OVERDUE
   0 of 6 tasks — tap to start
```

**Status colors:**
- 🟢 Green — submitted/approved
- 🟡 Yellow — in progress
- 🔴 Red — overdue
- ⚪ Gray — not yet started

### House Entry Screen

Each checklist step is a full-width card. The worker scrolls through sequentially:

```
🏠 House A — Day 14 of 35
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Dead birds today                     ✅ Required
  ┌─────────────────────────────────┐
  │    [ - ]      5      [ + ]      │
  │              birds              │
  │         📷 Add photo            │
  └─────────────────────────────────┘

  Feed bags consumed                   ✅ Required
  ┌─────────────────────────────────┐
  │    [ - ]      8      [ + ]      │
  │              bags               │
  └─────────────────────────────────┘

  House temperature                    ✅ Required
  ┌─────────────────────────────────┐
  │  Front  [ 32 ] °C               │
  │  Middle [ 31 ] °C               │
  │  Back   [ 30 ] °C               │
  └─────────────────────────────────┘

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [    Submit Day Report    ]    ⏱️ Due by 8:00 PM
```

---

## Deadline & Overdue System

### Farm-Level Deadline Configuration

The farm owner sets a daily submission deadline in their farm settings:

```
Daily Report Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Submission deadline:  [ 8:00 PM ▾ ]
  Timezone:             [ Asia/Dubai ▾ ]
  Notify on overdue:    ☑ Push notification  ☑ Email
```

### How Deadlines Work

1. When a `DailyLog` is auto-created, its `deadline` is set to the configured time for that day.
2. The worker's UI shows a countdown: "Due in 6h," "Due in 45min," etc.
3. If the deadline passes and `status` is still `DRAFT`, the system sets `status: OVERDUE`.
4. The supervisor and owner receive a notification (push and/or email) identifying which house and which worker missed the deadline.
5. The worker can still submit after the deadline — the log will show it was late.

---

## Computed Analytics (Layer 3 — Foundation)

The daily log data feeds into computed analytics. These are not stored in the DailyLog itself but derived on read or via periodic aggregation jobs.

### Key Metrics Derived from Daily Logs

| Metric | Formula | Source |
|--------|---------|--------|
| **Daily mortality** | deaths today / live birds start of day | DailyLog.entries (death count) |
| **Cumulative mortality %** | total deaths to date / initial placement | Sum of all DailyLog death entries |
| **Cumulative feed (kg)** | bags × bag weight (from FeedItem.quantitySize) | DailyLog.entries (feed bags) |
| **FCR (Feed Conversion Ratio)** | cumulative feed kg / total live weight gained | DailyLog feed + WeightSample |
| **Daily water:feed ratio** | water liters / feed kg | DailyLog entries |
| **Average daily gain (ADG)** | (current avg weight − previous avg weight) / days between | WeightSample series |
| **Growth curve** | avg weight plotted over cycle days | WeightSample series |
| **Flock uniformity** | coefficient of variation of weight samples | WeightSample.weights array |
| **Performance Index (PI)** | (livability % × avg weight kg) / (FCR × age days) × 100 | Composite |

### Alert Triggers (Future)

| Alert | Condition | Notify |
|-------|-----------|--------|
| Mortality spike | Today's deaths > 3× the 7-day rolling average | Supervisor, Vet, Owner |
| Missed submission | DailyLog status = OVERDUE | Supervisor, Owner |
| Low water intake | Water:feed ratio drops below threshold | Supervisor, Vet |
| Weight below target | Avg weight < breed standard for cycle day | Owner |
| High temperature | Any reading exceeds configured threshold | Supervisor |

### Daily Email Summary (Future)

An automated end-of-day email to the farm owner summarizing all houses:

```
Estera Farm — Day 14 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

House A: 3 deaths (0.1%) | 8 bags | 420L water | 32°C avg
House B: 1 death (0.02%) | 12 bags | 680L water | 31°C avg
House C: ⚠️ OVERDUE — no submission

Cumulative Mortality: 2.3% (target: <3%)
Estimated FCR: 1.62 (target: <1.70)
```

---

## S3 Storage Additions

New paths under the existing storage structure (see `STORAGE.md`):

```
{userId}/
  daily-logs/
    {dailyLogId}/
      {nanoid}.jpg                    ← daily log evidence photos
  weight-samples/
    {weightSampleId}/
      {nanoid}.jpg                    ← weight sampling evidence photos
```

---

## Backend File Additions

```
backend/
  models/
    House.js                          done — House schema (Phase 1)
    DailyLog.js                       done — unified daily log with logType discriminator (Phase 2)
  routes/
    houses.js                         done — CRUD for houses (Phase 1)
    dailyLogs.js                      done — CRUD with upsert, date validation (Phase 2)
```

---

## Frontend File Additions

```
frontend/src/
  pages/dashboard/
    batch/
      BatchOperationsView.js          done — Operations tab: per-house logs grouped by date
  components/
    HouseConfigurator.js              done — repeatable house name+capacity form section (Phase 1)
    daily-log/
      DailyLogSheet.js                done — side sheet form with log type toggle
```

---

## Phased Implementation Plan

### Phase 1: House Infrastructure

**Goal:** Introduce houses as a first-class entity, update Farm and Batch models, update all dependent UI.

**Backend:**
- [ ] Create `House` model
- [ ] Create `houses` routes (CRUD, scoped to farm, `protect` middleware)
- [ ] Update `Farm` model — remove `totalCapacity`
- [ ] Update `Farm` routes — house summary in farm GET responses
- [ ] Update `Batch` model — add `houses` embedded array
- [ ] Update `Batch` routes — validate house availability on create/update
- [ ] Add house-related entries to `DeletionLog` entity types
- [ ] Update sync routes for houses

**Frontend:**
- [ ] Build `HouseConfigurator` component (used in Add/Edit Farm forms)
- [ ] Update Farm forms to use `HouseConfigurator` instead of `totalCapacity` input
- [ ] Build `HouseSelector` component (used in batch creation)
- [ ] Update Batch creation/edit forms with house selection and per-house quantity
- [ ] Update `BatchOverview` to show house breakdown
- [ ] Add houses to offline sync (`db.js`, `syncEngine.js`)

**Migration:**
- [ ] Existing farms with `totalCapacity` get a single auto-generated house named "House 1" with that capacity
- [ ] Existing batches get a single house entry pointing to that auto-generated house

---

### Phase 2: Daily Logs (Unified Model)

**Goal:** Implement the unified DailyLog model with three log types (Daily, Weight, Environment), the Operations tab in the batch detail view, and the entry form sheet.

**Backend:**
- [x] Create `DailyLog` model (unified with `logType` discriminator)
- [x] Create daily log routes (CRUD with upsert, date validation, cycleDay computation)
- [x] Mount routes at `/api/daily-logs`

**Frontend — Offline:**
- [x] Add `dailyLogs` table to Dexie (version 4)
- [x] Add `dailyLogs` to syncEngine (ENTITY_LABELS, BATCH_SCOPED, resolveIds)

**Frontend — UI:**
- [x] Add tab strip (Overview | Operations) to `BatchDetailLayout`
- [x] Add `/dashboard/batches/:id/operations` route
- [x] Build `BatchOperationsView` — per-house collapsible sections, logs grouped by date
- [x] Build `DailyLogSheet` — log type toggle (EnumButtonSelect), conditional fields, date validation, upsert
- [x] Add i18n translation keys

**Deferred to future phases:**
- [ ] Protocol Engine (configurable checklists with ProtocolTemplate model)
- [ ] Status workflow (DRAFT/SUBMITTED/APPROVED/OVERDUE)
- [ ] Deadline & overdue system
- [ ] Modification audit trail
- [ ] Worker-facing checklist entry screen
- [ ] Supervisor approval flow

---

### Phase 4: Worker Auth & Assignments

**Goal:** Enable workers to log into the system with PIN or password and see only their assigned houses.

**Backend:**
- [ ] Add `pin` field to `Worker` model (hashed)
- [ ] Add `houseAssignments` field to `Worker` model
- [ ] Create PIN auth endpoint (`POST /api/auth/pin`)
- [ ] Add `veterinarian` to Worker role enum
- [ ] Role-based middleware for daily log / weight sample routes
- [ ] Worker-scoped queries (only return data for assigned houses)

**Frontend:**
- [ ] Build PIN login screen (big digit keypad, no keyboard)
- [ ] Build house assignment UI in worker management
- [ ] Scope the worker home screen to assigned houses only
- [ ] Role-conditional rendering (hide protocol config from labourers, hide approvals from labourers, etc.)

---

### Phase 5: Deadlines, Notifications & Overdue Tracking

**Goal:** Enforce submission deadlines and notify supervisors/owners of missed submissions.

**Backend:**
- [ ] Add deadline configuration to Farm model (submission time, timezone)
- [ ] Cron job or scheduled function to mark `DRAFT` logs as `OVERDUE` after deadline
- [ ] Push notification service integration
- [ ] Email notification for overdue submissions
- [ ] Overdue log query endpoint for supervisor dashboard

**Frontend:**
- [ ] Countdown timer on daily log entry screen
- [ ] Overdue indicators on supervisor dashboard
- [ ] Deadline configuration in farm settings
- [ ] Notification preferences UI

---

### Phase 6: Analytics & Alerts Foundation

**Goal:** Compute and display derived metrics from daily log and weight sample data.

**Backend:**
- [ ] Aggregation endpoints: cumulative mortality, cumulative feed, FCR, ADG
- [ ] Batch performance summary endpoint
- [ ] House comparison endpoint
- [ ] Alert rule engine (mortality spike, low water, weight below target)
- [ ] Daily summary email generation

**Frontend:**
- [ ] Batch analytics dashboard (mortality curve, feed consumption chart, growth curve)
- [ ] House comparison view (side-by-side metrics)
- [ ] Alert configuration UI (thresholds, notification channels)
- [ ] Daily email summary template and settings

---

## Open Design Questions

These should be resolved as implementation progresses:

1. **Template inheritance override:** If the protocol template is per-farm, should there be a mechanism to override at the house level for special cases (e.g., a quarantine house with extra checks)?

2. **Auto-creation vs on-demand daily logs:** Should empty DailyLog documents be auto-generated at midnight for all active houses (cleaner for overdue tracking), or created on-demand when the first worker opens the app (simpler for offline)?

3. **Multi-language step labels:** Workers in UAE speak Urdu, Hindi, Bengali, Arabic, English. Should protocol template step labels support multiple languages, or is the i18n system sufficient for the default template labels?

4. **Vet as external or internal:** Are veterinarians farm employees (Workers with a role) or external consultants (linked via Contact/Business)? This affects whether they're in the Worker model or get their own access model.

5. **Historical data backfill:** Should there be a way for supervisors to enter daily logs for past dates (e.g., catching up on paper records)?  If so, what constraints apply?

6. **Computed vs stored aggregates:** Should cumulative metrics (total deaths, total feed) be computed on-the-fly from the DailyLog collection, or stored as a separate `BatchSummary` document that gets recomputed on each submission? On-the-fly is simpler but slower at scale; stored summaries are faster but need cache invalidation.

---

## Relationship to Existing Models

This feature **layers on top** of the existing data model without disrupting it:

| Existing Model | Change | Impact |
|----------------|--------|--------|
| `Farm` | Remove `totalCapacity` field | Replaced by sum of `House.capacity` |
| `Batch` | Add `houses` embedded array | Links batch to specific houses with quantities |
| `Worker` | Add `pin`, `houseAssignments`, `veterinarian` role | Enables field access and scoping |
| `Source` | None | Business/financial layer unchanged |
| `FeedOrder` | None | Business/financial layer unchanged |
| `Expense` | None | Business/financial layer unchanged |
| `SaleOrder` | None | Business/financial layer unchanged |
| `Media` | None | New categories (`daily-log`, `weight-sample`) use existing upload flow |
| `DeletionLog` | Add `house`, `dailyLog`, `weightSample`, `protocolTemplate` entity types | Sync support |
