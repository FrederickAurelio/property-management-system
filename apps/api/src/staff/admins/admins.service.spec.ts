import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole as ContractAdminRole,
  ApiFieldReason,
} from '@cabin/api-contract';
import * as bcrypt from 'bcrypt';
import { AdminsService } from './admins.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole, Prisma } from '../../generated/prisma/index.js';

describe('AdminsService', () => {
  let service: AdminsService;
  let prisma: {
    admin: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const actor = {
    id: 'admin_actor',
    username: 'super',
    passwordHash: '',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const otherSuper = {
    id: 'admin_other',
    username: 'other.super',
    passwordHash: 'hash',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(async () => {
    actor.passwordHash = await bcrypt.hash('password123', 10);
    prisma = {
      admin: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AdminsService);
  });

  describe('list', () => {
    it('returns all admins as public rows', async () => {
      prisma.admin.findMany.mockResolvedValue([actor, otherSuper]);

      await expect(service.list()).resolves.toEqual([
        expect.objectContaining({ id: actor.id, username: 'super' }),
        expect.objectContaining({ id: otherSuper.id }),
      ]);
      expect(prisma.admin.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('creates admin when actor password is valid', async () => {
      prisma.admin.findUnique.mockResolvedValue(actor);
      const created = {
        ...otherSuper,
        id: 'admin_new',
        username: 'front.desk',
        role: AdminRole.FRONT_DESK,
      };
      prisma.admin.create.mockResolvedValue(created);

      await expect(
        service.create(actor.id, {
          username: 'front.desk',
          password: 'tempPass99',
          role: ContractAdminRole.FRONT_DESK,
          currentPassword: 'password123',
        }),
      ).resolves.toMatchObject({
        username: 'front.desk',
        role: AdminRole.FRONT_DESK,
      });

      expect(prisma.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'front.desk',
            role: AdminRole.FRONT_DESK,
            passwordHash: expect.any(String) as string,
          }) as { username: string; role: AdminRole; passwordHash: string },
        }),
      );
    });

    it('rejects invalid current password', async () => {
      prisma.admin.findUnique.mockResolvedValue(actor);

      await expect(
        service.create(actor.id, {
          username: 'front.desk',
          password: 'tempPass99',
          role: ContractAdminRole.FRONT_DESK,
          currentPassword: 'wrong',
        }),
      ).rejects.toMatchObject({
        response: {
          details: {
            field: 'currentPassword',
            reason: ApiFieldReason.INVALID_CURRENT_PASSWORD,
          },
        },
      });
    });

    it('maps unique violation to USERNAME_TAKEN', async () => {
      prisma.admin.findUnique.mockResolvedValue(actor);
      prisma.admin.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create(actor.id, {
          username: 'taken',
          password: 'tempPass99',
          role: ContractAdminRole.ADMIN,
          currentPassword: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changeRole', () => {
    it('rejects changing own role', async () => {
      prisma.admin.findUnique.mockResolvedValue(actor);

      await expect(
        service.changeRole(actor.id, actor.id, {
          role: ContractAdminRole.ADMIN,
          currentPassword: 'password123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects demoting the last active super admin', async () => {
      prisma.admin.findUnique
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(otherSuper);
      prisma.admin.count.mockResolvedValue(1);

      await expect(
        service.changeRole(actor.id, otherSuper.id, {
          role: ContractAdminRole.ADMIN,
          currentPassword: 'password123',
        }),
      ).rejects.toThrow('Cannot demote or revoke the last active super admin');
    });

    it('updates role when another active super remains', async () => {
      prisma.admin.findUnique
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(otherSuper);
      prisma.admin.count.mockResolvedValue(2);
      const updated = { ...otherSuper, role: AdminRole.ADMIN };
      prisma.admin.update.mockResolvedValue(updated);

      await expect(
        service.changeRole(actor.id, otherSuper.id, {
          role: ContractAdminRole.ADMIN,
          currentPassword: 'password123',
        }),
      ).resolves.toMatchObject({ role: AdminRole.ADMIN });
    });

    it('returns not found for missing target', async () => {
      prisma.admin.findUnique
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(null);

      await expect(
        service.changeRole(actor.id, 'missing', {
          role: ContractAdminRole.ADMIN,
          currentPassword: 'password123',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setActive', () => {
    it('rejects revoking self', async () => {
      prisma.admin.findUnique.mockResolvedValue(actor);

      await expect(
        service.setActive(actor.id, actor.id, {
          isActive: false,
          currentPassword: 'password123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects revoking the last active super admin', async () => {
      prisma.admin.findUnique
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(otherSuper);
      prisma.admin.count.mockResolvedValue(1);

      await expect(
        service.setActive(actor.id, otherSuper.id, {
          isActive: false,
          currentPassword: 'password123',
        }),
      ).rejects.toThrow('Cannot demote or revoke the last active super admin');
    });

    it('restores inactive admin', async () => {
      const inactive = { ...otherSuper, isActive: false };
      prisma.admin.findUnique
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(inactive);
      const restored = { ...inactive, isActive: true };
      prisma.admin.update.mockResolvedValue(restored);

      await expect(
        service.setActive(actor.id, otherSuper.id, {
          isActive: true,
          currentPassword: 'password123',
        }),
      ).resolves.toMatchObject({ isActive: true });
    });
  });
});
