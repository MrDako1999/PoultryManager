import multer from 'multer';

const ALLOWED_MIME_TYPES = [
  // Standard images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif',
  // Apple HEIC / HEIF — iPhone's default camera format. Without these,
  // every iOS user who hasn't switched their Camera setting to "Most
  // Compatible" hits "File type image/heic is not allowed" on upload.
  // The `-sequence` variants cover Live Photos and multi-frame stacks.
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

export const uploadMultiple = (fieldName = 'files', maxCount = 10) => upload.array(fieldName, maxCount);

const uploadAny = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const uploadSingleAny = (fieldName = 'file') => uploadAny.single(fieldName);

export const uploadMultipleAny = (fieldName = 'files', maxCount = 10) => uploadAny.array(fieldName, maxCount);
