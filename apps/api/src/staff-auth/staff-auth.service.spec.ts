import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StaffAuthService } from './staff-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRole } from '../generated/prisma/index.js';

describe('StaffAuthService', () => {
  let service: StaffAuthService;
  let prisma: { admin: { findUnique: jest.Mock } };

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
});
