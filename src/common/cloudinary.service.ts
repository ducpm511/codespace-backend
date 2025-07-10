//src/common/cloudinary.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';


@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadPdf(file: Express.Multer.File) {
    return new Promise((resolve, reject) => {
      const fileNameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'student-reports',
          use_filename: true,
          public_id: fileNameWithoutExt, // tên file không có đuôi
          format: 'pdf', // đảm bảo đuôi là pdf
          filename_override: file.originalname, // override nếu cần
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }
}
