import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnauthorizedRedirect } from "@/components/unauthorized-redirect";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/query-client";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="cabin-pms-theme"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UnauthorizedRedirect />
          <AppRoutes />
          {/* Temporary chrome — move into sidebar / login header later */}
          <div className="fixed top-3 right-3 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
