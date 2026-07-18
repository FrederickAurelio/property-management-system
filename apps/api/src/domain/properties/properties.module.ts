import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service.js';

@Module({
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
