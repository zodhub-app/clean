import { useState, type ReactNode } from "react";
import { Settings, UserRound } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSidebar } from "@/components/app-sidebar";
import { useLang } from "@/components/language-provider";
import { UpdateBell } from "@/components/update-bell";
import { NAV_ITEMS, type ViewId } from "@/lib/nav";
import { DashboardPage } from "@/pages/dashboard";
import { StoragePage } from "@/pages/storage";
import { SnapshotsPage } from "@/pages/snapshots";
import { ExplorerPage } from "@/pages/explorer";
import { DuplicatesPage } from "@/pages/duplicates";
import { AppsPage } from "@/pages/apps";
import { DevPage } from "@/pages/dev";
import { CachePage } from "@/pages/cache";
import { MemoryPage } from "@/pages/memory";
import { DSStorePage } from "@/pages/dsstore";
import { SchedulerPage } from "@/pages/scheduler";
import { SettingsPage } from "@/pages/settings";
import { AccountPage } from "@/pages/account";

export default function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const { t } = useLang();
  const active = NAV_ITEMS.find((i) => i.id === view) ?? NAV_ITEMS[0];

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar active={view} onNavigate={setView} />
      <SidebarInset className="min-h-0 overflow-hidden">
        {/* Fixed header: lives outside the scroll area, never moves. */}
        <header
          data-slot="topbar"
          data-tauri-drag-region=""
          className="flex h-11 shrink-0 items-center gap-2 border-b px-3"
        >
          <SidebarTrigger className="-ml-1 size-7" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex items-center gap-1.5">
            <active.icon className="size-3.5 text-muted-foreground" />
            <h1 className="text-xs font-medium">{t(active.title)}</h1>
          </div>
          <HeaderActions
            onOpenAccount={() => setView("account")}
            onOpenSettings={() => setView("settings")}
          />
        </header>
        {/* Área de contenido. Las páginas con scroll usan <ScrollPage> (scrollbar
            temático); Caché y .DS_Store ocupan todo el alto (flex-1) y gestionan
            su propio scroll interno. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === "dashboard" && (
            <ScrollPage>
              <DashboardPage />
            </ScrollPage>
          )}
          {view === "storage" && (
            <ScrollPage>
              <StoragePage />
            </ScrollPage>
          )}
          {view === "snapshots" && (
            <ScrollPage>
              <SnapshotsPage />
            </ScrollPage>
          )}
          {view === "explorer" && <ExplorerPage />}
          {view === "duplicates" && <DuplicatesPage />}
          {view === "apps" && <AppsPage />}
          {view === "dev" && <DevPage />}
          {view === "cache" && <CachePage />}
          {view === "memory" && (
            <ScrollPage>
              <MemoryPage />
            </ScrollPage>
          )}
          {view === "dsstore" && <DSStorePage />}
          {view === "scheduler" && (
            <ScrollPage>
              <SchedulerPage />
            </ScrollPage>
          )}
          {view === "settings" && (
            <ScrollPage>
              <SettingsPage />
            </ScrollPage>
          )}
          {view === "account" && (
            <ScrollPage>
              <AccountPage />
            </ScrollPage>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Página con scroll vertical y scrollbar temático (Radix). */
function ScrollPage({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-2.5">{children}</div>
    </ScrollArea>
  );
}

function HeaderActions({
  onOpenAccount,
  onOpenSettings,
}: {
  onOpenAccount: () => void;
  onOpenSettings: () => void;
}) {
  const { lang, toggle, t } = useLang();
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full bg-white/[0.05] hover:bg-white/10"
        aria-label={t("Ajustes")}
        title={t("Ajustes")}
        onClick={onOpenSettings}
      >
        <Settings />
      </Button>
      <UpdateBell />
      {/* Tu espacio: novedades, suscripción, apoyo y legal. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full bg-white/[0.05] hover:bg-white/10"
        aria-label={t("Tu espacio")}
        title={t("Tu espacio")}
        onClick={onOpenAccount}
      >
        <UserRound />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full bg-white/[0.05] text-sm hover:bg-white/10"
        title={`${t("Idioma")}: ${lang === "es" ? "Español" : "English"}`}
        aria-label={t("Idioma")}
        onClick={toggle}
      >
        <span className="leading-none">{lang === "es" ? "🇪🇸" : "🇬🇧"}</span>
      </Button>
    </div>
  );
}
