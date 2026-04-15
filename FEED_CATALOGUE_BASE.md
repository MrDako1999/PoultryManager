# Feed Catalogue Base Data — Future Implementation

## Overview

The Feed Catalogue currently supports user-owned feed items (`FeedItem` model) where each user manages their own catalogue with custom pricing. A planned enhancement is a **system-level base catalogue** (`FeedCatalogueBase`) that provides a shared reference of feed products available in the market.

## Planned `FeedCatalogueBase` Schema

A global collection with no `user_id` — shared across all users as read-only reference data.

```
FeedCatalogueBase {
  companyName       String     // Feed company name (not linked to any user's Business)
  feedDescription   String     // Product title
  feedType          Enum       // STARTER, GROWER, FINISHER, OTHER
  defaultQtySize    Number     // Default quantity size (e.g. 50)
  defaultQtyUnit    String     // Default unit (e.g. KG)
  isActive          Boolean    // Whether this base item is currently available
  createdAt         Date
  updatedAt         Date
}
```

No pricing data — base items represent "these products exist" without any user-specific cost.

## How Users Import Base Data

Two potential approaches:

### Option A: Browse & Import
- User visits the Feed Catalogue page and sees a "Browse Available Products" section or button.
- A dialog/sheet shows the base catalogue items grouped by company.
- User selects items to import → creates `FeedItem` records in their own catalogue.
- Imported items copy the base data (description, type, qty) but require the user to set their own price and link to a Business in their directory.

### Option B: Seed on Registration
- When a new user registers, automatically seed their catalogue with all active base items.
- Each seeded item becomes an independent `FeedItem` that the user can modify or delete.
- Downside: users may not want all items, and it bloats their catalogue upfront.

**Recommended: Option A** — gives users control over what they add.

## Super Admin Panel

A future admin interface for managing the base catalogue:

- CRUD operations on `FeedCatalogueBase` items.
- Bulk import from spreadsheet/CSV.
- Toggle items active/inactive.
- Track which companies and products are available in the market.
- Potentially track regional availability (UAE, Saudi, etc.).

## Data Seeding

The actual base catalogue data (company names, product descriptions, feed types) will be provided and entered via the super admin panel or a seed script. The data comes from real market feed suppliers.

## Files with TODO References

The following files contain `// TODO: FeedCatalogueBase` comments marking where integration points will be added:

- `backend/models/FeedItem.js`
- `backend/routes/feedItems.js`
- `frontend/src/pages/dashboard/directory/FeedCataloguePage.js`
