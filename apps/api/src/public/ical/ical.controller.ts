import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IcalExportService } from '../../domain/ical/ical-export.service.js';

@Controller('public/ical')
export class PublicIcalController {
  constructor(private readonly icalExportService: IcalExportService) {}

  @Get('units/:unitId.ics')
  async getUnitIcs(
    @Param('unitId') unitId: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const body = await this.icalExportService.getUnitIcs(unitId, token);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).send(body);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Calendar not found',
          },
        });
        return;
      }
      throw error;
    }
  }
}
