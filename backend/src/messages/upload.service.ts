import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
]);

@Injectable()
export class UploadService {
  private readonly configured: boolean;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.configured = !!(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<{ url: string; originalName: string; mimeType: string }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`Тип файла ${mimeType} не разрешён`);
    }

    if (!this.configured) {
      throw new BadRequestException('Загрузка файлов не настроена. Задайте CLOUDINARY_* переменные в .env');
    }

    const resourceType =
      mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') || mimeType.startsWith('audio/') ? 'video' : 'raw';

    let url: string;
    try {
      url = await new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: 'connexy',
            use_filename: false,
            unique_filename: true,
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'));
            resolve(result.secure_url);
          },
        );
        stream.end(buffer);
      });
    } catch (err) {
      const msg =
        (err as { message?: string; error?: { message?: string } }).error?.message ||
        (err as { message?: string }).message ||
        'Upload failed';
      throw new BadRequestException(`Cloudinary upload failed: ${msg}`);
    }

    return { url, originalName, mimeType };
  }
}

