/* anchor: Linear exception strip, diverge: same bordered panel; muted header wash only */
import { useMemo } from "react";
import type { StaffDashboardListItem } from "@cabin/api-contract";
import { DashboardStayList } from "./dashboard-row";
import { DashboardPanel } from "./dashboard-section";
import {
  dominantNeedsBoard,
  reservationsBoardHref,
} from "./dashboard-format";

type DashboardNeedsSectionProps = {
  total: number;
  items: StaffDashboardListItem[];
  propertyId: string;
  opsDate: string;
  dashboardSearch: string;
};

export function DashboardNeedsSection({
  total,
  items,
  propertyId,
  opsDate,
  dashboardSearch,
}: DashboardNeedsSectionProps) {
  const attentionById = useMemo(() => {
    const map: Record<string, StaffDashboardListItem["attentionKinds"]> = {};
    for (const row of items) {
      map[row.id] = row.attentionKinds;
    }
    return map;
  }, [items]);

  if (total === 0) return null;

  const allKinds = items.flatMap((r) => r.attentionKinds ?? []);
  const board = dominantNeedsBoard(allKinds);
  const viewAllHref = reservationsBoardHref(board, propertyId);

  return (
    <DashboardPanel
      title="Needs attention"
      total={total}
      viewAllHref={viewAllHref}
      attention
    >
      <DashboardStayList
        items={items}
        opsDate={opsDate}
        dashboardSearch={dashboardSearch}
        attentionById={attentionById}
        showWhyColumn
      />
    </DashboardPanel>
  );
}
