/* anchor: Linear-dense explorer, diverge: Property → type → unit drill-down */
import { Outlet } from "react-router";
import { ExplorerParamsProvider } from "@/components/explorer/explorer-params";

export function PropertyExplorerLayout() {
  return (
    <ExplorerParamsProvider>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:gap-5 md:p-6">
        <Outlet />
      </div>
    </ExplorerParamsProvider>
  );
}
