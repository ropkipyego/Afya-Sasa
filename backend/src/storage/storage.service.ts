import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'afyasasa-clinical-files');
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', 'afyasasa'),
        secretAccessKey: this.config.get<string>(
          'S3_SECRET_ACCESS_KEY',
          'afyasasa123',
        ),
      },
    });
  }

  async presignUpload(input: {
    key: string;
    contentType: string;
    folder?: string;
  }) {
    const key = this.normaliseKey(input.key, input.folder);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
    });

    return {
      bucket: this.bucket,
      key,
      method: 'PUT',
      url: await getSignedUrl(this.client, command, { expiresIn: 15 * 60 }),
      expiresInSeconds: 15 * 60,
    };
  }

  async presignDownload(key: string) {
    const normalisedKey = this.normaliseKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: normalisedKey,
    });

    return {
      bucket: this.bucket,
      key: normalisedKey,
      method: 'GET',
      url: await getSignedUrl(this.client, command, { expiresIn: 10 * 60 }),
      expiresInSeconds: 10 * 60,
    };
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const normalisedKey = this.normaliseKey(key);
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
    return Buffer.concat(chunks);
  }

  private normaliseKey(key: string, folder?: string) {
    const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    if (!folder) {
      return safeKey;
    }
    return `${folder.replace(/^\/+|\/+$/g, '')}/${safeKey}`;
  }
}
