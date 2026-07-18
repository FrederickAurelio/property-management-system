import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../auth/staff-auth.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
