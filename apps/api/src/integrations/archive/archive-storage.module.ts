import { Module } from '@nestjs/common';
import { GarageArchiveStorageAdapter } from './adapters/garage.adapter.js';
import { ARCHIVE_STORAGE } from './archive-storage.port.js';

@Module({
  providers: [
    { provide: ARCHIVE_STORAGE, useClass: GarageArchiveStorageAdapter },
  ],
  exports: [ARCHIVE_STORAGE],
})
export class ArchiveStorageModule {}
