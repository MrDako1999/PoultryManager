import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

let _client = null;

export function getS3Client() {
  if (!_client) {
    const accessKeyId = process.env.HETZNER_S3_ACCESS_KEY;
    const secretAccessKey = process.env.HETZNER_S3_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `S3 credentials not configured. HETZNER_S3_ACCESS_KEY: ${accessKeyId ? 'set' : 'MISSING'}, HETZNER_S3_SECRET_KEY: ${secretAccessKey ? 'set' : 'MISSING'}. Check your .env file.`
      );
    }

    _client = new S3Client({
      endpoint: process.env.HETZNER_S3_ENDPOINT,
      region: process.env.HETZNER_S3_REGION,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return _client;
}

export const getBucket = () => process.env.HETZNER_S3_BUCKET;
