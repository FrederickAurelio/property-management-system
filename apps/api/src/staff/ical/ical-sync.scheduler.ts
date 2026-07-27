import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IcalImportService } from '../../domain/ical/ical-import.service.js';

@Injectable()
export class IcalSyncScheduler {
  private readonly logger = new Logger(IcalSyncScheduler.name);

  constructor(private readonly icalImportService: IcalImportService) {}

  /** Pull all active OTA feeds every 15 minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    try {
      const result = await this.icalImportService.syncAll();
      if (result.feedsAttempted > 0) {
        this.logger.log(
          `iCal sync: ${result.feedsOk}/${result.feedsAttempted} ok` +
            (result.feedsFailed ? `, ${result.feedsFailed} failed` : ''),
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `iCal cron failed: ${error instanceof Error ? error.message : 'error'}`,
      );
    }
  }
}
