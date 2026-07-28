import { BrowserRouter, Route, Routes } from "react-router";

import { ThemeProvider } from "@/components/theme-provider";
import { HomePage } from "@/pages/home-page";

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="cabin-web-theme"
      disableTransitionOnChange
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
