import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  PropertyExpenseCategory,
  buildPageInfo,
  type Paginated,
  type StaffAdmin,
  type StaffPropertyExpense,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { parseYmd } from '../reservations/reservations-mapper.js';
import type { CreatePropertyExpenseDto } from './dto/create-property-expense.dto.js';
import type { ListPropertyExpensesQueryDto } from './dto/list-property-expenses.query.dto.js';
import type { UpdatePropertyExpenseDto } from './dto/update-property-expense.dto.js';
import { toStaffPropertyExpense } from './expenses-mapper.js';

type Actor = Pick<StaffAdmin, 'id'>;

const expenseInclude = {
  unit: { select: { code: true, name: true } },
  createdByAdmin: { select: { username: true } },
  updatedByAdmin: { select: { username: true } },
} as const;

function trimNote(note: string | null | undefined): string | null {
  if (note == null) return null;
  const t = note.trim();
  return t.length === 0 ? null : t;
}

function emptyToNull(id: string | null | undefined): string | null {
  if (id == null || id.trim() === '') return null;
  return id;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListPropertyExpensesQueryDto,
  ): Promise<Paginated<StaffPropertyExpense>> {
    if (query.from > query.to) {
      throw new BadRequestException({
        message: 'from must be on or before to',
        details: { field: 'from', reason: ApiFieldReason.DATE_RANGE_INVALID },
      });
    }

    const property = await this.prisma.property.findUnique({
      where: { id: query.propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const where: Prisma.PropertyExpenseWhereInput = {
      propertyId: query.propertyId,
      occurredOn: {
        gte: parseYmd(query.from),
        lte: parseYmd(query.to),
      },
    };
    if (query.category) {
      where.category = query.category;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.propertyExpense.count({ where }),
      this.prisma.propertyExpense.findMany({
        where,
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: expenseInclude,
      }),
    ]);

    return {
      items: rows.map(toStaffPropertyExpense),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<StaffPropertyExpense> {
    const row = await this.prisma.propertyExpense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!row) {
      throw new NotFoundException('Expense not found');
    }
    return toStaffPropertyExpense(row);
  }

  async create(
    dto: CreatePropertyExpenseDto,
    actor: Actor,
  ): Promise<StaffPropertyExpense> {
    const note = trimNote(dto.note);
    this.assertOtherNote(dto.category, note);
    const unitId = emptyToNull(dto.unitId);
    await this.assertPropertyAndUnit(dto.propertyId, unitId);

    const row = await this.prisma.propertyExpense.create({
      data: {
        propertyId: dto.propertyId,
        unitId,
        category: dto.category,
        amountIdr: BigInt(dto.amountIdr),
        occurredOn: parseYmd(dto.occurredOn),
        note,
        proofImages:
          (dto.proofImages as unknown as Prisma.InputJsonValue) ?? [],
        createdByAdminId: actor.id,
        updatedByAdminId: actor.id,
      },
      include: expenseInclude,
    });
    return toStaffPropertyExpense(row);
  }

  async update(
    id: string,
    dto: UpdatePropertyExpenseDto,
    actor: Actor,
  ): Promise<StaffPropertyExpense> {
    const existing = await this.prisma.propertyExpense.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    const category = dto.category ?? existing.category;
    const note = dto.note !== undefined ? trimNote(dto.note) : existing.note;
    this.assertOtherNote(category, note);

    const unitId =
      dto.unitId !== undefined ? emptyToNull(dto.unitId) : existing.unitId;
    await this.assertPropertyAndUnit(existing.propertyId, unitId);

    const row = await this.prisma.propertyExpense.update({
      where: { id },
      data: {
        ...(dto.occurredOn !== undefined
          ? { occurredOn: parseYmd(dto.occurredOn) }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amountIdr !== undefined
          ? { amountIdr: BigInt(dto.amountIdr) }
          : {}),
        unitId,
        note,
        ...(dto.proofImages !== undefined
          ? {
              proofImages: dto.proofImages as unknown as Prisma.InputJsonValue,
            }
          : {}),
        updatedByAdminId: actor.id,
      },
      include: expenseInclude,
    });
    return toStaffPropertyExpense(row);
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.propertyExpense.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }
    await this.prisma.propertyExpense.delete({ where: { id } });
    return { ok: true };
  }

  private assertOtherNote(
    category: PropertyExpenseCategory,
    note: string | null,
  ): void {
    if (category === PropertyExpenseCategory.OTHER && note == null) {
      throw new BadRequestException({
        message: 'A note is required for Other expenses',
        details: { field: 'note', reason: ApiFieldReason.NOTE_REQUIRED },
      });
    }
  }

  private async assertPropertyAndUnit(
    propertyId: string,
    unitId: string | null,
  ): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (!unitId) {
      return;
    }
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, propertyId: true },
    });
    if (!unit || unit.propertyId !== propertyId) {
      throw new BadRequestException({
        message: 'Unit not found on this property',
        details: { field: 'unitId', reason: ApiFieldReason.UNIT_INVALID },
      });
    }
  }
}
