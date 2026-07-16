import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiFieldReason } from '@cabin/api-contract';
import * as bcrypt from 'bcrypt';
import { StaffAuthService } from './staff-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRole, Prisma } from '../generated/prisma/index.js';

describe('StaffAuthService', () => {
  let service: StaffAuthService;
  let prisma: {
    admin: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const adminRow = {
    id: 'admin_1',
    username: 'super',
    passwordHash: '',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    adminRow.passwordHash = await bcrypt.hash('password123', 10);
    prisma = {
      admin: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffAuthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StaffAuthService);
  });

  it('returns public admin when credentials match', async () => {
    prisma.admin.findUnique.mockResolvedValue(adminRow);

    await expect(
      service.validateCredentials('super', 'password123'),
    ).resolves.toEqual({
      id: adminRow.id,
      username: adminRow.username,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      createdAt: adminRow.createdAt.toISOString(),
      updatedAt: adminRow.updatedAt.toISOString(),
    });
  });

  it('rejects bad password', async () => {
    prisma.admin.findUnique.mockResolvedValue(adminRow);

    await expect(
      service.validateCredentials('super', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing admin', async () => {
    prisma.admin.findUnique.mockResolvedValue(null);

    await expect(
      service.validateCredentials('nobody', 'password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('changeUsername', () => {
    it('updates username when password is valid', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);
      const updated = { ...adminRow, username: 'ops.manager' };
      prisma.admin.update.mockResolvedValue(updated);

      await expect(
        service.changeUsername('admin_1', 'ops.manager', 'password123'),
      ).resolves.toMatchObject({ username: 'ops.manager' });

      expect(prisma.admin.update).toHaveBeenCalledWith({
        where: { id: 'admin_1' },
        data: { username: 'ops.manager' },
      });
    });

    it('rejects unchanged username', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);

      await expect(
        service.changeUsername('admin_1', 'super', 'password123'),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'username',
            reason: ApiFieldReason.USERNAME_UNCHANGED,
          },
        },
      });
      expect(prisma.admin.update).not.toHaveBeenCalled();
    });

    it('rejects invalid current password', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);

      await expect(
        service.changeUsername('admin_1', 'ops.manager', 'wrong'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps unique violation to USERNAME_TAKEN', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);
      prisma.admin.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.changeUsername('admin_1', 'taken', 'password123'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('updates hash when current password is valid', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);
      prisma.admin.update.mockResolvedValue(adminRow);

      await expect(
        service.changePassword('admin_1', 'password123', 'newpass456'),
      ).resolves.toEqual({ ok: true });

      expect(prisma.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'admin_1' },
          data: expect.objectContaining({
            passwordHash: expect.any(String) as string,
          }) as { passwordHash: string },
        }),
      );
    });

    it('rejects same as current password', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);

      await expect(
        service.changePassword('admin_1', 'password123', 'password123'),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'newPassword',
            reason: ApiFieldReason.SAME_AS_CURRENT,
          },
        },
      });
      expect(prisma.admin.update).not.toHaveBeenCalled();
    });

    it('rejects invalid current password', async () => {
      prisma.admin.findUnique.mockResolvedValue(adminRow);

      await expect(
        service.changePassword('admin_1', 'wrong', 'newpass456'),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'currentPassword',
            reason: ApiFieldReason.INVALID_CURRENT_PASSWORD,
          },
        },
      });
    });
  });
});
