import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { PublicAdmin } from '@cabin/api-contract';
import type { Request, Response } from 'express';
import { StaffAuthService } from './staff-auth.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { StaffLoginDto } from './dto/staff-login.dto';
import { StaffSessionAuthGuard } from './guards/staff-session-auth.guard';
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
} from './session.util';

@Controller('staff/auth')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
  ): Promise<PublicAdmin> {
    const admin = await this.staffAuthService.validateCredentials(
      dto.username,
      dto.password,
    );

    await regenerateSession(req);
    req.session.adminId = admin.id;

    return admin;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffSessionAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await destroySession(req);
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(StaffSessionAuthGuard)
  me(@CurrentAdmin() admin: PublicAdmin): PublicAdmin {
    return admin;
  }
}
