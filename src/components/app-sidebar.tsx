import { Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navFor, NAV_ITEMS, type ViewId } from "@/lib/nav";
import { useLang } from "@/components/language-provider";
import { useOs } from "@/components/os-provider";
import { SidebarPromo } from "@/components/sidebar-promo";

export function AppSidebar({
  active,
  onNavigate,
}: {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  const { t } = useLang();
  const os = useOs();
  // Solo las secciones que existen en este sistema.
  const items = navFor(os);
  const main = items.filter((i) => i.id !== "settings" && !i.hideInSidebar);
  const settings = NAV_ITEMS.find((i) => i.id === "settings")!;

  return (
    <Sidebar>
      <SidebarHeader>
        {/* Espacio para el semáforo de la ventana (barra de título superpuesta). */}
        <div data-tauri-drag-region="" className="h-8" />
        <div
          data-tauri-drag-region=""
          className="flex items-center gap-2 px-2 py-1"
        >
          <div className="logo-badge flex aspect-square size-7 items-center justify-center rounded-md text-white">
            <Sparkles className="size-4" />
          </div>
          <div className="grid leading-tight">
            <span className="gradient-text text-[13px] font-semibold">
              ZodHub CleanPC
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t("Mantenimiento del equipo")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    tooltip={t(item.title)}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon />
                    <span>{t(item.title)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Espacio de novedades/banner (hendidura), encima de Ajustes. */}
        <SidebarPromo />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={active === settings.id}
              tooltip={t(settings.title)}
              onClick={() => onNavigate(settings.id)}
            >
              <settings.icon />
              <span>{t(settings.title)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
