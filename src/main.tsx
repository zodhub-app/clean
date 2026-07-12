import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { Toaster } from "@/components/ui/sonner";
import { UpdateNotifier } from "@/components/update-notifier";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <App />
        <UpdateNotifier />
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
