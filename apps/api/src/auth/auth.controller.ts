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
import { AuthService } from './auth.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
} from './session.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<PublicAdmin> {
    const admin = await this.authService.validateCredentials(
      dto.username,
      dto.password,
    );

    await regenerateSession(req);
    req.session.adminId = admin.id;

    return admin;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await destroySession(req);
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentAdmin() admin: PublicAdmin): PublicAdmin {
    return admin;
  }
}
