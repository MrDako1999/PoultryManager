# Storage Architecture — Hetzner S3 Object Storage

> Reference document for AI prompts and development. This defines the agreed-upon storage structure, security model, file naming conventions, and backend implementation for PoultryManager's media/file storage system.

---

## Provider

- **Hetzner Object Storage** (S3-compatible)
- **Bucket name:** `poultrymanager`
- **Region:** `fsn1` (Falkenstein)
- **Endpoint:** `https://fsn1.your-objectstorage.com`
- **SDK:** `@aws-sdk/client-s3` (AWS SDK v3, works with Hetzner's S3-compatible API)
- **ID generation:** `nanoid` (12-character, URL-safe)

---

## Security Model

- **Bucket visibility:** Public (read-only) — files are accessible via direct URL
- **Listing disabled:** No public `ListBucket` — nobody can browse or enumerate bucket contents
- **File privacy:** UUID/nanoid-based filenames make URLs unguessable (~71 bits of entropy at 12 chars)
- **Authorization:** Backend verifies user ownership before generating upload paths or returning file URLs
- **No pre-signed URLs** for V1 — direct public URLs are sufficient given the unguessable paths
- **Ownership enforcement:** The `Media` MongoDB collection tracks which user owns each file; all queries are scoped to `user_id`

### Why this is sufficient

- S3 does not allow directory listing without explicit `ListBucket` permission
- A 12-character nanoid has ~71 bits of entropy — brute-forcing is computationally infeasible
- Each file path is additionally scoped under the user's MongoDB ObjectId (24 hex chars)
- Files are served as public URLs (no tokens, no expiry) — suitable for images, documents, and generated files

---

## S3 Object Key Structure

All files are rooted under the user's MongoDB `_id`. This enables:
- **Data export:** Zip everything under `{userId}/` to give users their data
- **Account deletion:** Delete the entire `{userId}/` prefix in one batch operation
- **Authorization boundary:** Backend only serves files from `{authenticatedUserId}/...`

```
{bucket}/
  {userId}/
    profile/
      {nanoid}.jpg                              ← avatar, profile images
    farms/
      {farmId}/
        images/
          {nanoid}.webp                         ← farm/shed photos
        documents/
          {nanoid}.pdf                          ← farm licenses, permits
    batches/
      {batchId}/
        images/
          {nanoid}.jpg                          ← batch photos, health records
    invoices/
      SALES_INV_{nanoid}.pdf                    ← system-generated sales invoices
    reports/
      BATCH_REPORT_{nanoid}.pdf                 ← system-generated reports
    businesses/
      {businessId}/
        {nanoid}.pdf                            ← TRN cert, trade license, other docs
    contacts/
      {contactId}/
        {nanoid}.pdf                            ← contact attachments
    workers/
      {workerId}/
        {nanoid}.pdf                            ← EID, visa, passport, other docs
    sources/
      {sourceId}/
        {nanoid}.pdf                            ← tax invoices, transfer proofs, delivery notes
    expenses/
      {expenseId}/
        {nanoid}.pdf                            ← expense receipts, transfer proofs, docs
    exports/
      {nanoid}.zip                              ← data export packages
```

### Key rules

- `{userId}` = MongoDB ObjectId (24-char hex string, e.g. `695a722aa7ca77a5186108d6`)
- `{farmId}`, `{batchId}` = MongoDB ObjectIds of the related entity
- `{nanoid}` = 12-character nanoid generated at upload time (e.g. `V1StGXR8_Z5j`)
- Entity sub-paths (farms, batches) nest by entity ID for bulk operations per entity
- System-generated files (invoices, reports) use a descriptive prefix + nanoid (e.g. `SALES_INV_V1StGXR8_Z5j.pdf`)
- User-uploaded files use nanoid-only filenames; the original filename is stored in the `Media` document

### URL format

```
https://fsn1.your-objectstorage.com/poultrymanager/{userId}/farms/{farmId}/images/{nanoid}.webp
```

---

## File Naming Conventions

| Category | Filename Pattern | Example |
|----------|-----------------|---------|
| User-uploaded images | `{nanoid}.{ext}` | `V1StGXR8_Z5j.webp` |
| User-uploaded documents | `{nanoid}.{ext}` | `mhvXdrZT4jP5.pdf` |
| Sales invoices | `SALES_INV_{nanoid}.pdf` | `SALES_INV_xK9mR2pQ4w.pdf` |
| Batch reports | `BATCH_REPORT_{nanoid}.pdf` | `BATCH_REPORT_8dfR4kx9Qz.pdf` |
| Source documents | `{nanoid}.{ext}` | `jP5T8vBxuvm7.pdf` |
| Expense receipts | `{nanoid}.{ext}` | `kL6mN7oP8qR9.pdf` |
| Profile photos | `{nanoid}.{ext}` | `aB3cD4eF5gH6.jpg` |
| Data exports | `{nanoid}.zip` | `qW2eR3tY4uI5.zip` |

The original filename (as named on the user's device) is always preserved in the `Media.original_filename` field.

---

## Backend File Structure

```
backend/
  config/
    s3.js                     ← S3Client initialization (Hetzner endpoint + credentials)
  models/
    Media.js                  ← Global media Mongoose schema
  services/
    storageService.js         ← Upload, delete, query functions (S3 + MongoDB)
  middleware/
    upload.js                 ← multer memory storage configuration
  routes/
    media.js                  ← Media CRUD API endpoints
```

---

## S3 Config — `backend/config/s3.js`

- Initializes `S3Client` from `@aws-sdk/client-s3`
- Uses env vars: `HETZNER_S3_ENDPOINT`, `HETZNER_S3_REGION`, `HETZNER_S3_ACCESS_KEY`, `HETZNER_S3_SECRET_KEY`
- Exports the client instance and `HETZNER_S3_BUCKET` bucket name
- Uses `forcePathStyle: true` (required for Hetzner S3 compatibility)

### Env vars (in `backend/.env`)

```
HETZNER_S3_BUCKET=poultrymanager
HETZNER_S3_ENDPOINT=https://fsn1.your-objectstorage.com
HETZNER_S3_REGION=fsn1
HETZNER_S3_ACCESS_KEY=<your-access-key>
HETZNER_S3_SECRET_KEY=<your-secret-key>
```

---

## Media Model — `backend/models/Media.js`

Global MongoDB collection for all uploaded/generated files. Every file in the S3 bucket has a corresponding `Media` document.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | ObjectId (ref: User) | Yes | Owner of the file |
| `url` | String | Yes | Full public URL to the file |
| `key` | String (unique) | Yes | S3 object key (full path without bucket) |
| `filename` | String | Yes | Stored filename on S3 (includes nanoid) |
| `original_filename` | String | No | Original filename from user's device |
| `file_size` | Number | No | Size in bytes |
| `mime_type` | String | No | MIME type (e.g. `image/jpeg`, `application/pdf`) |
| `width` | Number | No | Image width in pixels (null for non-images) |
| `height` | Number | No | Image height in pixels (null for non-images) |
| `media_type` | String (enum) | No | One of: `image`, `document`, `report`, `invoice`, `receipt` |
| `category` | String | No | Contextual grouping (e.g. `farm`, `batch`, `profile`, `expense`) |
| `entity_type` | String | No | Related entity type (e.g. `farm`, `batch`, `user`) |
| `entity_id` | ObjectId | No | Related entity's MongoDB `_id` |
| `storage_provider` | String | No | Default: `hetzner` (for future flexibility) |
| `createdAt` | Date (auto) | Yes | Timestamp |
| `updatedAt` | Date (auto) | Yes | Timestamp |

### Indexes

- `{ user_id: 1, entity_type: 1, entity_id: 1 }` — compound index for queries like "all images for this farm"
- `{ key: 1 }` — unique index on S3 key

---

## Storage Service — `backend/services/storageService.js`

All S3 and Media document operations go through this service. Route handlers never call S3 directly.

### Functions

- **`uploadFile({ file, userId, entityType, entityId, category, mediaType, customPrefix })`**
  - Generates a 12-char nanoid
  - Builds S3 key: `{userId}/{category}/{entityId}/{filename}.{ext}` (with optional custom prefix)
  - Uploads to S3 via `PutObject` with `public-read` ACL
  - Creates a `Media` document in MongoDB
  - Returns the saved media document

- **`deleteFile(mediaId, userId)`**
  - Finds the Media document, verifies `user_id` matches
  - Calls `DeleteObject` on S3
  - Removes the Media document from MongoDB

- **`getFilesByEntity(entityType, entityId, userId)`**
  - Queries Media collection filtered by entity + user
  - Returns array of media documents

- **`getFilesByUser(userId)`**
  - Returns all media for a user (used for data export)

- **`deleteAllByEntity(entityType, entityId, userId)`**
  - Bulk deletes all S3 objects and Media documents for a given entity

- **`buildObjectUrl(key)`**
  - Constructs: `https://{endpoint}/{bucket}/{key}`

---

## Upload Middleware — `backend/middleware/upload.js`

- Uses `multer` with **memory storage** (file buffer stays in memory, no disk writes)
- File size limit: **10MB** (configurable)
- Accepted MIME types: `image/*`, `application/pdf`, common document types
- Exports: `uploadSingle(fieldName)`, `uploadMultiple(fieldName, maxCount)`

---

## Media API Routes — `backend/routes/media.js`

All routes require authentication (`protect` middleware).

| Method | Path | Body/Params | Description |
|--------|------|-------------|-------------|
| POST | `/api/media/upload` | `file` (multipart) + `entityType`, `entityId`, `category`, `mediaType` | Upload a single file |
| GET | `/api/media` | Query: `?entityType=&entityId=&category=` | List user's media (filtered) |
| GET | `/api/media/:id` | — | Get single media document (ownership check) |
| DELETE | `/api/media/:id` | — | Delete file from S3 + MongoDB (ownership check) |
| DELETE | `/api/media/entity/:entityType/:entityId` | — | Bulk delete all media for an entity |

---

## Upload Flow (step by step)

1. Client sends `POST /api/media/upload` with `multipart/form-data` (file + metadata fields)
2. `multer` memory middleware captures the file buffer
3. Route handler extracts metadata from `req.body` and user from `req.user`
4. Calls `storageService.uploadFile()` which:
   - Generates a 12-char nanoid
   - Builds the S3 key based on `userId`, `category`, `entityId`, and the nanoid filename
   - Uploads the buffer to Hetzner S3 via `PutObject`
   - Constructs the public URL
   - Saves a `Media` document to MongoDB with all metadata
5. Returns the `Media` document (including `url`) to the client

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | latest | S3 operations (PutObject, DeleteObject, ListObjectsV2) |
| `nanoid` | latest | 12-char unique ID generation for filenames |
| `multer` | ^1.4.5-lts.1 | Already installed — multipart form handling |

---

## Future Considerations

- **Pre-signed URLs:** Can be added later for sensitive file categories (e.g. financial reports for ADAFSA) without changing the Media model — just stop returning `url` and generate signed URLs on-the-fly instead
- **Image processing:** Could add image resizing/optimization before S3 upload (e.g. sharp for thumbnails)
- **Storage quotas:** Per-user storage limits tracked by summing `file_size` in the Media collection
- **CDN layer:** A CDN (e.g. Cloudflare) can be placed in front of the Hetzner bucket for faster global delivery
