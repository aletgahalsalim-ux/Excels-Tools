import { Injectable, Logger } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Object storage behind a driver switch (STORAGE_DRIVER=s3|local).
 * s3    → MinIO / any S3-compatible store (production path, docker-compose)
 * local → filesystem under STORAGE_LOCAL_PATH (dev & CI environments
 *         where container registries are unavailable)
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver = process.env.STORAGE_DRIVER ?? 'local';
  private readonly localRoot = process.env.STORAGE_LOCAL_PATH ?? path.resolve('storage');
  private readonly bucket = process.env.S3_BUCKET ?? 'afdip-files';
  private s3: S3Client | null = null;
  private bucketReady = false;

  private getS3(): S3Client {
    if (!this.s3) {
      this.s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? '',
          secretAccessKey: process.env.S3_SECRET_KEY ?? '',
        },
      });
    }
    return this.s3;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    const s3 = this.getS3();
    try {
      await s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket ${this.bucket}`);
    }
    this.bucketReady = true;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.driver === 's3') {
      await this.ensureBucket();
      await this.getS3().send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
      );
      return;
    }
    const filePath = path.join(this.localRoot, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }

  async get(key: string): Promise<Buffer> {
    if (this.driver === 's3') {
      await this.ensureBucket();
      const res = await this.getS3().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await res.Body!.transformToByteArray());
    }
    return fs.readFile(path.join(this.localRoot, key));
  }
}
