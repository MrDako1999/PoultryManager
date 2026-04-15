import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  uploadFile,
  deleteFile,
  getFilesByEntity,
  getFilesByUser,
  deleteAllByEntity,
} from '../services/storageService.js';

const router = express.Router();

// POST /api/media/upload — upload a single file
router.post('/upload', protect, (req, res, next) => {
  uploadSingle('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { entityType, entityId, category, mediaType, customPrefix } = req.body;

    const media = await uploadFile({
      file: req.file,
      userId: req.user._id.toString(),
      entityType,
      entityId,
      category,
      mediaType,
      customPrefix,
    });

    res.status(201).json(media);
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/media — list user's media with optional filters
router.get('/', protect, async (req, res) => {
  try {
    const { entityType, entityId, category } = req.query;

    if (entityType && entityId) {
      const files = await getFilesByEntity(entityType, entityId, req.user._id);
      return res.json(files);
    }

    const query = { user_id: req.user._id };
    if (entityType) query.entity_type = entityType;
    if (category) query.category = category;

    const { default: Media } = await import('../models/Media.js');
    const files = await Media.find(query).sort({ createdAt: -1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/media/:id — get a single media document
router.get('/:id', protect, async (req, res) => {
  try {
    const { default: Media } = await import('../models/Media.js');
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (media.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this file' });
    }

    res.json(media);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/media/:id — delete a single file
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await deleteFile(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    const status = err.message === 'File not found' ? 404
      : err.message === 'Not authorized to delete this file' ? 403
      : 500;
    res.status(status).json({ message: err.message });
  }
});

// DELETE /api/media/entity/:entityType/:entityId — bulk delete for an entity
router.delete('/entity/:entityType/:entityId', protect, async (req, res) => {
  try {
    const result = await deleteAllByEntity(
      req.params.entityType,
      req.params.entityId,
      req.user._id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
