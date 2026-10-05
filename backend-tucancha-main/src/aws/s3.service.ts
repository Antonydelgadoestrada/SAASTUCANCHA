import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

import { PutBucketPolicyCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service implements OnModuleInit {
  private s3Client: S3Client;
  private bucket: string;
  private endpoint: string;
  private readonly logger = new Logger(S3Service.name);

  constructor() {
    this.bucket = process.env.DO_SPACES_BUCKET || 'tucancha';
    this.endpoint = process.env.DO_SPACES_ENDPOINT || 'https://sfo3.digitaloceanspaces.com';
    
    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: process.env.DO_SPACES_REGION || 'sfo3',
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
      },
      forcePathStyle: false, 
    });
    this.logger.log(`⚡ S3Service initialized for DO Spaces endpoint: ${this.endpoint}, bucket: ${this.bucket}`);
  }

  async onModuleInit() {
    // Configurar automáticamente la política del Bucket para que todas las imágenes sean públicas
    // Esto resuelve el error de "Access Denied" o "Unsupported ACL" sin intervención manual
    if (process.env.DO_SPACES_KEY) {
      try {
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicReadGetObject",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };
        await this.s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify(policy),
          })
        );
        this.logger.log(`✅ DO Spaces Bucket Policy set to PUBLIC for bucket: ${this.bucket}`);
      } catch (err: any) {
        this.logger.warn(`⚠️ Could not auto-set bucket policy (might already be set or missing permissions): ${err.message}`);
      }
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    folderPath = 'uploads'
  ): Promise<string> {
    const cleanFolderPath = folderPath.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
    const safeName = originalName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    const fileName = `${uuidv4()}-${safeName}`;
    const key = cleanFolderPath ? `${cleanFolderPath}/${fileName}`.replace(/\/+/g, '/') : fileName;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: 'public-read', // Restaurado, ya que la llave Full Access permite esto
      })
    );

    // Formato de URL pública de DO Spaces: https://<bucket>.<region>.digitaloceanspaces.com/<key>
    const endpointHost = this.endpoint.replace('https://', '');
    return `https://${this.bucket}.${endpointHost}/${key}`;
  }

  extractKeyFromUrl(url: string): string {
    const endpointHost = this.endpoint.replace('https://', '');
    const prefix = `https://${this.bucket}.${endpointHost}/`;
    if (url.startsWith(prefix)) {
      return url.replace(prefix, '');
    }
    return '';
  }

  async deleteFile(key: string): Promise<void> {
    if (!key) return;
    const cleanKey = key.replace(/^\//, '').replace(/\/+/g, '/');

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        })
      );
      this.logger.log(`🗑️ Deleted file from DO Spaces: ${cleanKey}`);
    } catch (err: any) {
      this.logger.warn(`⚠️ Error deleting file from DO Spaces ${cleanKey}: ${err.message}`);
    }
  }

  async updateImage(
    oldImageUrl: string | null,
    newBuffer: Buffer,
    originalName: string,
    mimetype: string,
    folderPath = 'uploads'
  ): Promise<string> {
    const newImageUrl = await this.uploadFile(newBuffer, originalName, mimetype, folderPath);

    if (oldImageUrl) {
      const keyToDelete = this.extractKeyFromUrl(oldImageUrl);
      if (keyToDelete) {
        await this.deleteFile(keyToDelete);
      }
    }

    return newImageUrl;
  }

  async getSignedUrl(key: string): Promise<string> {
    const cleanKey = key.replace(/^\//, '').replace(/\/+/g, '/');
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (err: any) {
      this.logger.warn(`⚠️ Error signing URL for DO Spaces for ${cleanKey}: ${err.message}`);
      const endpointHost = this.endpoint.replace('https://', '');
      return `https://${this.bucket}.${endpointHost}/${cleanKey}`;
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const cleanKey = key.replace(/^\//, '').replace(/\/+/g, '/');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  async uploadFiles(images: any[], folderPath: string, prefix = 'public') {
    const urls: string[] = [];
    const cleanFolderPath = `${prefix}/${folderPath}`.replace(/\/+/g, '/');

    for (const image of images) {
      const url = await this.uploadFile(
        image.buffer,
        image.originalname,
        image.mimetype,
        cleanFolderPath
      );
      urls.push(url);
    }
    return urls;
  }
}
