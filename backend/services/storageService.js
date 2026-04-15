import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import path from 'path';
import { getS3Client, getBucket } from '../config/s3.js';
import Media from '../models/Media.js';

export function buildObjectUrl(key) {
  const endpoint = process.env.HETZNER_S3_ENDPOINT;
  const bucket = getBucket();
  return `${endpoint}/${bucket}/${key}`;
}

function getExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext || '';
}

/**
 * Upload a file to S3 and create a Media document.
 *
 * @param {Object} params
 * @param {Object} params.file - multer file object (buffer, originalname, mimetype, size)
 * @param {string} params.userId - owner's MongoDB ObjectId
 * @param {string} [params.entityType] - related entity type (farm, batch, user)
 * @param {string} [params.entityId] - related entity's ObjectId
 * @param {string} [params.category] - contextual grouping (farm, batch, profile, expense)
 * @param {string} [params.mediaType] - image, document, report, invoice, receipt
 * @param {string} [params.customPrefix] - optional prefix for the filename (e.g. SALES_INV_)
 * @returns {Promise<Object>} saved Media document
 */
export async function uploadFile({ file, userId, entityType, entityId, category, mediaType, customPrefix }) {
  const s3 = getS3Client();
  const bucket = getBucket();

  const id = nanoid(12);
  const ext = getExtension(file.originalname);
  const filename = customPrefix ? `${customPrefix}${id}${ext}` : `${id}${ext}`;

  const keyParts = [userId];
  if (category) keyParts.push(category);
  if (entityId) keyParts.push(entityId);
  keyParts.push(filename);

  const key = keyParts.join('/');

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    })
  );

  const url = buildObjectUrl(key);

  const media = await Media.create({
    user_id: userId,
    url,
    key,
    filename,
    original_filename: file.originalname,
    file_size: file.size,
    mime_type: file.mimetype,
    media_type: mediaType,
    category,
    entity_type: entityType,
    entity_id: entityId,
    storage_provider: 'hetzner',
  });

  return media;
}

/**
 * Delete a single file from S3 and remove its Media document.
 * Verifies ownership before deleting.
 */
export async function deleteFile(mediaId, userId) {
  const s3 = getS3Client();
  const bucket = getBucket();
  const media = await Media.findById(mediaId);

  if (!media) {
    throw new Error('File not found');
  }

  if (media.user_id.toString() !== userId.toString()) {
    throw new Error('Not authorized to delete this file');
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: media.key,
    })
  );

  await Media.findByIdAndDelete(mediaId);

  return { success: true };
}

/**
 * Get all media for a specific entity, scoped to a user.
 */
export async function getFilesByEntity(entityType, entityId, userId) {
  return Media.find({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  }).sort({ createdAt: -1 });
}

/**
 * Get all media for a user (for data export).
 */
export async function getFilesByUser(userId) {
  return Media.find({ user_id: userId }).sort({ createdAt: -1 });
}

/**
 * Bulk delete all files for an entity (e.g. when deleting a farm).
 * Removes from both S3 and MongoDB.
 */
export async function deleteAllByEntity(entityType, entityId, userId) {
  const s3 = getS3Client();
  const bucket = getBucket();

  const files = await Media.find({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  });

  const deletePromises = files.map((file) =>
    s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: file.key,
      })
    )
  );

  await Promise.all(deletePromises);

  const result = await Media.deleteMany({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  });

  return { deleted: result.deletedCount };
}
