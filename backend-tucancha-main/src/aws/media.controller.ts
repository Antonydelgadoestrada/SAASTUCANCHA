import { Controller, Get, Req, Res, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { S3Service } from './s3.service';

@Controller('media')
export class MediaController {
  constructor(private readonly s3Service: S3Service) {}

  @Get('*')
  async proxyMedia(@Req() req: Request, @Res() res: Response) {
    // Extraer la ruta después de /media/
    // req.path puede ser "/media/uploads/mi-imagen.png"
    const key = req.path.replace(/^\/media\//, '');
    
    if (!key) {
      throw new NotFoundException('Archivo no especificado');
    }

    try {
      const stream = await this.s3Service.getFileStream(key);
      
      // Asignar Content-Type básico según la extensión
      if (key.toLowerCase().endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (key.toLowerCase().endsWith('.jpg') || key.toLowerCase().endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (key.toLowerCase().endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      } else if (key.toLowerCase().endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      }
      
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      stream.pipe(res);
    } catch (err: any) {
      res.status(404).send('Imagen no encontrada o acceso denegado');
    }
  }
}
