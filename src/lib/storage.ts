import { Client } from 'minio';
import { Readable } from 'node:stream';
import { getEnv } from './env';

/**
 * Lưu file gốc của lô nhập (docs/rules/01, 12). Interface để test dùng bản trong bộ nhớ
 * (CI không chạy MinIO); chạy thật dùng MinIO.
 */
export interface ObjectStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Đọc theo stream — bộ đọc file xử lý từng dòng, không nạp cả file vào bộ nhớ. */
  getStream(key: string): Promise<Readable>;
}

class MinioStorage implements ObjectStorage {
  private bucketReady: Promise<void> | undefined;

  constructor(
    private readonly client: Client,
    private readonly bucket: string,
  ) {}

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
    })().catch((error: unknown) => {
      this.bucketReady = undefined;
      throw error;
    });
    return this.bucketReady;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, key, data, data.length, {
      'Content-Type': contentType,
    });
  }

  async getStream(key: string): Promise<Readable> {
    await this.ensureBucket();
    return this.client.getObject(this.bucket, key);
  }
}

/** Bản trong bộ nhớ — chỉ dùng cho test. */
export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Buffer>();

  put(key: string, data: Buffer): Promise<void> {
    this.objects.set(key, data);
    return Promise.resolve();
  }

  getStream(key: string): Promise<Readable> {
    const data = this.objects.get(key);
    if (!data) return Promise.reject(new Error(`Không có đối tượng ${key}`));
    return Promise.resolve(Readable.from(data));
  }
}

declare global {
  var __ewarsStorage: ObjectStorage | undefined;
}

export function getStorage(): ObjectStorage {
  if (!globalThis.__ewarsStorage) {
    const env = getEnv();
    const client = new Client({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
    globalThis.__ewarsStorage = new MinioStorage(client, env.MINIO_BUCKET);
  }
  return globalThis.__ewarsStorage;
}

/** Test thay bằng `MemoryStorage`. */
export function setStorage(storage: ObjectStorage | undefined): void {
  globalThis.__ewarsStorage = storage;
}
