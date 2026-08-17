import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION!;
    this.bucket = process.env.AWS_BUCKET_NAME!;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    folderPath = 'uploads' // default
  ): Promise<string> {
    const fileName = `${uuidv4()}-${originalName}`;
    const key = `${folderPath}/${fileName}`;
  
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      // ACL: 'public-read',
    });
  
    await this.s3.send(command);
  
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  extractKeyFromUrl(url: string, bucket: string, region: string): string {
    const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com/`;
    return url.replace(baseUrl, '');
  }
  
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
  
    await this.s3.send(command);
  }
  
  async updateImage(
    oldImageUrl: string | null,
    newBuffer: Buffer,
    originalName: string,
    mimetype: string,
    folderPath = 'uploads'
  ): Promise<string> {
    // 1. Subir nueva imagen
    const newImageUrl = await this.uploadFile(newBuffer, originalName, mimetype, folderPath);
  
    // 2. Borrar imagen anterior (si existe)
    if (oldImageUrl) {
      const keyToDelete = this.extractKeyFromUrl(oldImageUrl, this.bucket, this.region);
      await this.deleteFile(keyToDelete);
    }
  
    return newImageUrl;
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hora
  }

  async getFileStream(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const { Body } = await this.s3.send(command);
    return Body as Readable;
  }

  async uploadFiles(images, path:string, prefix='public'){
    const urls: string[] = [];

      for (const image of images) {
        const url = await this.uploadFile(
          image.buffer,
          image.originalname,
          image.mimetype,
          `${prefix}/${path}` // carpeta en tu bucket S3
        );
        urls.push(url);
      }
      return urls
  }
}
