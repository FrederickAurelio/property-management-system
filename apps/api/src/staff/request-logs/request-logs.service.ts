import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildPageInfo,
  REQUEST_LOGS_DEFAULT_WINDOW_MS,
  REQUEST_LOGS_LOOKBACK_MS,
  REQUEST_LOGS_QUERY_CAP,
  type StaffRequestLogItem,
  type StaffRequestLogsList,
} from '@cabin/api-contract';
import type { RequestLogsQueryDto } from './dto/request-logs.query.dto.js';
import { dateToLokiNs, LokiQueryClient } from './loki-query.client.js';
import { buildRequestLogsLogql } from './request-logs.logql.js';
import { mapLokiEntry } from './request-logs.mapper.js';

function parseIso(value: string, field: string): Date {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new BadRequestException(`Invalid ${field} timestamp`);
  }
  return new Date(ms);
}

function matchesListFilters(
  item: StaffRequestLogItem,
  query: RequestLogsQueryDto,
): boolean {
  if (query.app && item.app !== query.app) {
    return false;
  }
  const actor = query.actor?.trim();
  if (actor && !item.actor.toLowerCase().includes(actor.toLowerCase())) {
    return false;
  }
  const path = query.path?.trim();
  if (path && !item.path.toLowerCase().includes(path.toLowerCase())) {
    return false;
  }
  const requestId = query.requestId?.trim();
  if (
    requestId &&
    !item.requestId.toLowerCase().includes(requestId.toLowerCase())
  ) {
    return false;
  }
  if (query.errorsOnly && item.status < 400) {
    return false;
  }
  return true;
}

@Injectable()
export class RequestLogsService {
  constructor(private readonly loki: LokiQueryClient) {}

  async list(query: RequestLogsQueryDto): Promise<StaffRequestLogsList> {
    const range = this.resolveRange(query);
    const logql = buildRequestLogsLogql({
      q: query.q,
      requestId: query.requestId,
      path: query.path,
      app: query.app,
      actor: query.actor,
      errorsOnly: query.errorsOnly,
    });

    const raw = await this.loki.queryRange({
      query: logql,
      startNs: dateToLokiNs(range.from),
      endNs: dateToLokiNs(range.to),
      limit: REQUEST_LOGS_QUERY_CAP,
    });

    const items: StaffRequestLogItem[] = [];
    for (const [nsTs, line] of raw) {
      const mapped = mapLokiEntry(nsTs, line);
      if (mapped && matchesListFilters(mapped, query)) {
        items.push(mapped);
      }
    }

    items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));

    const truncated = raw.length >= REQUEST_LOGS_QUERY_CAP;
    const page = query.page;
    const pageSize = query.pageSize;
    const total = items.length;
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      pageInfo: buildPageInfo(page, pageSize, total),
      truncated,
    };
  }

  private resolveRange(query: RequestLogsQueryDto): { from: Date; to: Date } {
    const now = Date.now();
    const requestId = query.requestId?.trim();

    if (requestId) {
      return {
        from: new Date(now - REQUEST_LOGS_LOOKBACK_MS),
        to: new Date(now),
      };
    }

    let toMs = query.to ? parseIso(query.to, 'to').getTime() : now;
    let fromMs = query.from
      ? parseIso(query.from, 'from').getTime()
      : toMs - REQUEST_LOGS_DEFAULT_WINDOW_MS;

    if (toMs > now) {
      toMs = now;
    }
    const earliest = now - REQUEST_LOGS_LOOKBACK_MS;
    if (fromMs < earliest) {
      fromMs = earliest;
    }

    if (fromMs >= toMs) {
      throw new BadRequestException('from must be before to');
    }

    return { from: new Date(fromMs), to: new Date(toMs) };
  }
}
