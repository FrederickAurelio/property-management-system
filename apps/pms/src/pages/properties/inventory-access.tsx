import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { canManageInventory } from "@/lib/staff-permissions";

type InventoryAccess = {
  canManage: boolean;
};

const InventoryAccessContext = createContext<InventoryAccess | null>(null);

export function InventoryAccessProvider({ children }: { children: ReactNode }) {
  const { data: staff } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
  });

  const canManage = staff ? canManageInventory(staff.role) : false;

  return (
    <InventoryAccessContext.Provider value={{ canManage }}>
      {children}
    </InventoryAccessContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventoryAccess(): InventoryAccess {
  const ctx = useContext(InventoryAccessContext);
  if (!ctx) {
    throw new Error(
      "useInventoryAccess must be used within InventoryAccessProvider",
    );
  }
  return ctx;
}
