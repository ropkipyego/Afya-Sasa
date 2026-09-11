import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertAllowedUpload } from './storage.constants';
import { mimeFromFilename } from '../common/simple-pdf';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'afyasasa-clinical-files');
    const credentials = {
      accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', 'afyasasa'),
      secretAccessKey: this.config.get<string>(
        'S3_SECRET_ACCESS_KEY',
        'afyasasa123',
      ),
    };
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    this.client = new S3Client({
      region,
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      forcePathStyle,
      credentials,
    });

    const publicEndpoint =
      this.config.get<string>('S3_PUBLIC_ENDPOINT') ??
      this.config.get<string>('S3_ENDPOINT');
    this.presignClient = new S3Client({
      region,
      endpoint: publicEndpoint,
      forcePathStyle,
      credentials,
    });
  }

  async uploadObject(input: {
    buffer: Buffer;
    filename: string;
    contentType: string;
    folder: string;
    requestId: string;
    tenantCode?: string;
  }) {
    try {
      assertAllowedUpload({
        contentType: input.contentType,
        fileSize: input.buffer.length,
        filename: input.filename,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const safeName = input.filename.replace(/[^\w.-]+/g, '_');
    const relativeKey = `${input.folder}/${input.requestId}/${Date.now()}-${safeName}`;
    const key = this.tenantKey(relativeKey, input.tenantCode);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );

    return {
      bucket: this.bucket,
      key,
      filename: input.filename,
      mimeType: input.contentType,
      storagePath: key,
      fileSize: input.buffer.length,
    };
  }

  async presignUpload(input: {
    key: string;
    contentType: string;
    folder?: string;
    tenantCode?: string;
    fileSize?: number;
    filename?: string;
  }) {
    try {
      assertAllowedUpload({
        contentType: input.contentType,
        fileSize: input.fileSize,
        filename: input.filename ?? input.key.split('/').pop(),
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const key = this.tenantKey(input.key, input.tenantCode, input.folder);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
    });

    return {
      bucket: this.bucket,
      key,
      method: 'PUT',
      url: await getSignedUrl(this.presignClient, command, { expiresIn: 15 * 60 }),
      expiresInSeconds: 15 * 60,
    };
  }

  async presignDownload(key: string, tenantCode?: string) {
    const normalisedKey = this.tenantKey(key, tenantCode);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: normalisedKey,
    });

    return {
      bucket: this.bucket,
      key: normalisedKey,
      method: 'GET',
      url: await getSignedUrl(this.presignClient, command, { expiresIn: 10 * 60 }),
      expiresInSeconds: 10 * 60,
    };
  }

  async getObjectBuffer(key: string, tenantCode?: string): Promise<Buffer> {
    const { buffer } = await this.getObject(key, tenantCode);
    return buffer;
  }

  async getObject(
    key: string,
    tenantCode?: string,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const normalisedKey = this.tenantKey(key, tenantCode);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: normalisedKey }),
    );
    const body = response.Body;
    if (!body) {
      throw new Error(`Object not found: ${normalisedKey}`);
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const filename = normalisedKey.split('/').pop() ?? 'download';
    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType || mimeFromFilename(filename),
      filename,
    };
  }

  private tenantKey(key: string, tenantCode?: string, folder?: string) {
    const safeKey = this.normaliseKey(key, folder);
    if (!tenantCode) {
      return safeKey;
    }
    const prefix = `${tenantCode.replace(/^\/+|\/+$/g, '')}/`;
    if (safeKey.startsWith(prefix)) {
      return safeKey;
    }
    return `${prefix}${safeKey}`;
  }

  private normaliseKey(key: string, folder?: string) {
    const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    if (!folder) {
      return safeKey;
    }
    return `${folder.replace(/^\/+|\/+$/g, '')}/${safeKey}`;
  }
}
