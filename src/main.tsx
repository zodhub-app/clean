import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { UpdatesProvider } from "@/components/updates-provider";
import { OsProvider } from "@/components/os-provider";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <OsProvider>
          <UpdatesProvider>
            <App />
            <Toaster richColors position="bottom-right" />
          </UpdatesProvider>
        </OsProvider>
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
