import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private get supabaseUrl(): string {
    return (process.env.SUPABASE_URL || 'https://fartlyhtwqgklcvweetb.supabase.co').replace(/\/$/, '');
  }

  private get supabaseKey(): string {
    return process.env.SUPABASE_KEY || '';
  }

  private get supabaseBucket(): string {
    return process.env.SUPABASE_BUCKET || 'tucancha';
  }

  constructor() {
    console.log(`⚡ Supabase Storage initialized for project URL: ${this.supabaseUrl}, bucket: ${this.supabaseBucket}`);
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

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${key}`;

    await axios.post(uploadUrl, buffer, {
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        'Content-Type': mimetype,
        'x-upsert': 'true',
      },
    });

    // Public URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    return `${this.supabaseUrl}/storage/v1/object/public/${this.supabaseBucket}/${key}`;
  }

  extractKeyFromUrl(url: string): string {
    // Expected format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const prefix = `${this.supabaseUrl}/storage/v1/object/public/${this.supabaseBucket}/`;
    if (url.startsWith(prefix)) {
      return url.replace(prefix, '');
    }
    return '';
  }

  async deleteFile(key: string): Promise<void> {
    if (!key) return;
    const cleanKey = key.replace(/^\//, '').replace(/\/+/g, '/');
    const deleteUrl = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}`;

    try {
      await axios.delete(deleteUrl, {
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          prefixes: [cleanKey],
        },
      });
      console.log(`🗑️ Deleted Supabase file: ${cleanKey}`);
    } catch (err) {
      console.warn(`⚠️ No se pudo borrar el archivo de Supabase ${cleanKey}:`, err.response?.data || err.message);
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
    const signUrl = `${this.supabaseUrl}/storage/v1/object/sign/${this.supabaseBucket}/${cleanKey}`;
    try {
      const res = await axios.post(signUrl, { expiresIn: 3600 }, {
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });
      return `${this.supabaseUrl}${res.data.signedURL}`;
    } catch (err) {
      console.warn(`⚠️ Error al firmar URL en Supabase para ${cleanKey}:`, err.message);
      return `${this.supabaseUrl}/storage/v1/object/public/${this.supabaseBucket}/${cleanKey}`;
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const cleanKey = key.replace(/^\//, '').replace(/\/+/g, '/');
    const downloadUrl = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${cleanKey}`;
    const res = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
      },
      responseType: 'stream',
    });
    return res.data as Readable;
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
