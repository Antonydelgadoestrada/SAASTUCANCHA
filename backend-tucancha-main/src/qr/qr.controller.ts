// src/qr/qr.controller.ts
import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import * as QRCode from "qrcode";               // 👈 CAMBIO AQUÍ
import { QrQueryDto } from "./qr.dto";

@Controller("qr")
export class QrController {
  @Get()
  async generate(@Query() q: QrQueryDto, @Res() res: Response) {
    try {
      const opts = {
        errorCorrectionLevel: q.ecLevel,
        scale: q.scale,
        margin: q.margin,
      };

      if (q.format === "svg") {
        const svg = await QRCode.toString(q.url, { type: "svg", ...opts });
        res.setHeader("Content-Type", "image/svg+xml");
        return res.send(svg);
      }

      const png = await QRCode.toBuffer(q.url, { type: "png", ...opts });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(png);
    } catch (e: any) {
      console.error("[QR ERROR]", e);
      throw new BadRequestException("No se pudo generar el QR");
    }
  }
}
