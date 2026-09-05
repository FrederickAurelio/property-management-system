import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiFieldReason, PropertyExpenseCategory } from '@cabin/api-contract';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: {
    property: { findUnique: jest.Mock };
    unit: { findUnique: jest.Mock };
    propertyExpense: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const row = {
    id: 'e1',
    propertyId: 'p1',
    unitId: null,
    category: PropertyExpenseCategory.UTILITIES,
    amountIdr: BigInt(300_000),
    occurredOn: new Date('2026-07-10T00:00:00.000Z'),
    note: 'PLN',
    proofImages: [],
    createdAt: new Date('2026-07-10T01:00:00.000Z'),
    updatedAt: new Date('2026-07-10T01:00:00.000Z'),
    createdByAdminId: 'a1',
    updatedByAdminId: 'a1',
    unit: null,
    createdByAdmin: { username: 'owner' },
    updatedByAdmin: { username: 'owner' },
  };

  beforeEach(async () => {
    prisma = {
      property: { findUnique: jest.fn() },
      unit: { findUnique: jest.fn() },
      propertyExpense: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  it('rejects from after to', async () => {
    await expect(
      service.list({
        propertyId: 'p1',
        from: '2026-07-10',
        to: '2026-07-01',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 when property missing on create', async () => {
    prisma.property.findUnique.mockResolvedValue(null);
    await expect(
      service.create(
        {
          propertyId: 'missing',
          occurredOn: '2026-07-10',
          category: PropertyExpenseCategory.UTILITIES,
          amountIdr: 1000,
        },
        { id: 'a1' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a note for OTHER', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'p1' });
    await expect(
      service.create(
        {
          propertyId: 'p1',
          occurredOn: '2026-07-10',
          category: PropertyExpenseCategory.OTHER,
          amountIdr: 1000,
          note: '  ',
        },
        { id: 'a1' },
      ),
    ).rejects.toMatchObject({
      response: {
        details: { field: 'note', reason: ApiFieldReason.NOTE_REQUIRED },
      },
    });
  });

  it('rejects a unit from another property', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.unit.findUnique.mockResolvedValue({ id: 'u2', propertyId: 'p2' });
    await expect(
      service.create(
        {
          propertyId: 'p1',
          occurredOn: '2026-07-10',
          category: PropertyExpenseCategory.MAINTENANCE,
          amountIdr: 50_000,
          unitId: 'u2',
        },
        { id: 'a1' },
      ),
    ).rejects.toMatchObject({
      response: {
        details: { field: 'unitId', reason: ApiFieldReason.UNIT_INVALID },
      },
    });
  });

  it('creates an expense', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.propertyExpense.create.mockResolvedValue(row);
    const saved = await service.create(
      {
        propertyId: 'p1',
        occurredOn: '2026-07-10',
        category: PropertyExpenseCategory.UTILITIES,
        amountIdr: 300_000,
        note: 'PLN',
      },
      { id: 'a1' },
    );
    expect(saved.amountIdr).toBe(300_000);
    expect(saved.occurredOn).toBe('2026-07-10');
    expect(saved.createdByAdminUsername).toBe('owner');
  });
});
