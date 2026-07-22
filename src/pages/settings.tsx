import { useEffect, useState, type ReactNode } from "react";
import { Check, Monitor, Moon, PanelTop, Sun } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useLang } from "@/components/language-provider";
import { useUpdates } from "@/components/updates-provider";
import { getTrayVisible, setTrayVisible } from "@/lib/api";
import {
  autoRefreshEnabled,
  setAutoRefreshEnabled,
} from "@/hooks/use-cached-resource";
import { THEMES } from "@/lib/themes";

const SCALES = [
  { v: 0.8, label: "80%" },
  { v: 0.9, label: "90%" },
  { v: 1, label: "100%" },
  { v: 1.1, label: "110%" },
];

function SettingCard({
  title,
  desc,
  span,
  headerRight,
  titleRight,
  children,
}: {
  title: string;
  desc?: string;
  span?: boolean;
  headerRight?: ReactNode;
  titleRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-3 py-4", span && "md:col-span-2")}>
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {titleRight}
        </div>
        {(desc || headerRight) && (
          <div className="flex items-center justify-between gap-2">
            <CardDescription className="text-xs">{desc}</CardDescription>
            {headerRight}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

function MiniCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"
    >
      <span
        className={cn(
          "flex size-3.5 items-center justify-center rounded-[3px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input",
        )}
      >
        {checked && <Check className="size-2.5" />}
      </span>
      {label}
    </button>
  );
}

function LabeledRange({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "opacity-40")}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="macup-range w-full cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

/** Interruptor del icono de la barra de menús de macOS. Va en la fila del
 *  título de «Apariencia»; toda la explicación está en el tooltip. */
function TrayToggle() {
  const { t } = useLang();
  const [on, setOn] = useState(true);
  useEffect(() => {
    getTrayVisible()
      .then(setOn)
      .catch(() => {});
  }, []);
  async function toggle(v: boolean) {
    setOn(v);
    try {
      await setTrayVisible(v);
    } catch {
      /* en desarrollo web (sin Tauri) no hay comando */
    }
  }
  return (
    <span
      className="flex items-center gap-1.5"
      title={t(
        "Barra de menús: muestra el icono de ZodHub Pulse en la barra superior de macOS para acceso rápido. Con él activo, cerrar la ventana deja ZodHub Pulse en la barra.",
      )}
    >
      <PanelTop className="size-3.5 text-muted-foreground" />
      <Switch checked={on} onCheckedChange={toggle} />
    </span>
  );
}

export function SettingsPage() {
  const {
    theme,
    setTheme,
    mode,
    setMode,
    scale,
    setScale,
    skin,
    setSkin,
    bg,
    setBg,
    material,
    setMaterial,
    blur,
    setBlur,
    noise,
    setNoise,
    shadow,
    setShadow,
    fxSidebar,
    setFxSidebar,
    heraFiligree,
    setHeraFiligree,
    smoothScroll,
    setSmoothScroll,
  } = useTheme();
  const { t } = useLang();
  const u = useUpdates();
  // Auto-refresh de la caché de pestañas (persistido en localStorage).
  const [cacheAuto, setCacheAuto] = useState(autoRefreshEnabled());

  const shadowNames = [
    t("Ninguna"),
    t("Suave"),
    t("Normal"),
    t("Fuerte"),
    t("Muy fuerte"),
  ];

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <SettingCard
          title={t("Apariencia")}
          desc={t("Claro, oscuro o el del sistema.")}
          titleRight={<TrayToggle />}
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            onValueChange={(v) => v && setMode(v as typeof mode)}
          >
            <ToggleGroupItem value="light" className="gap-1.5 px-3 text-xs">
              <Sun className="size-3.5" />
              {t("Claro")}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="gap-1.5 px-3 text-xs">
              <Moon className="size-3.5" />
              {t("Oscuro")}
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="gap-1.5 px-3 text-xs">
              <Monitor className="size-3.5" />
              {t("Sistema")}
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingCard>

        <SettingCard
          title={t("Tamaño de la interfaz")}
          desc={t("Escala toda la app.")}
          headerRight={
            <MiniCheck
              checked={smoothScroll}
              onChange={setSmoothScroll}
              label={t("Scroll suave")}
            />
          }
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(scale)}
            onValueChange={(v) => v && setScale(Number(v))}
          >
            {SCALES.map((s) => (
              <ToggleGroupItem
                key={s.v}
                value={String(s.v)}
                className="px-3 text-xs tabular-nums"
              >
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingCard>

        <SettingCard
          title={t("Estilo de superficie")}
          desc={t("Zeus: relieve 3D. Hera: diseño de cristal flotante.")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={skin}
              onValueChange={(v) => v && setSkin(v as typeof skin)}
            >
              <ToggleGroupItem value="none" className="px-3 text-xs">
                {t("Plano")}
              </ToggleGroupItem>
              <ToggleGroupItem value="zeus" className="px-3 text-xs">
                Zeus
              </ToggleGroupItem>
              <ToggleGroupItem value="hera" className="px-3 text-xs">
                Hera
              </ToggleGroupItem>
            </ToggleGroup>
            {skin === "hera" && (
              <MiniCheck
                checked={heraFiligree}
                onChange={setHeraFiligree}
                label={t("Filigrana")}
              />
            )}
          </div>
        </SettingCard>

        <SettingCard title={t("Fondo")} desc={t("Para el estilo Plano.")}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={bg}
            onValueChange={(v) => v && setBg(v as typeof bg)}
          >
            <ToggleGroupItem value="none" className="px-3 text-xs">
              {t("Liso")}
            </ToggleGroupItem>
            <ToggleGroupItem value="gradient" className="px-3 text-xs">
              {t("Degradado")}
            </ToggleGroupItem>
            <ToggleGroupItem value="aurora" className="px-3 text-xs">
              {t("Aurora")}
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingCard>

        <SettingCard
          title={t("Material de las tarjetas")}
          desc={t("Sólido, cristal o cristal mate con grano.")}
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={material}
            onValueChange={(v) => v && setMaterial(v as typeof material)}
          >
            <ToggleGroupItem value="solid" className="px-3 text-xs">
              {t("Sólido")}
            </ToggleGroupItem>
            <ToggleGroupItem value="glass" className="px-3 text-xs">
              {t("Cristal")}
            </ToggleGroupItem>
            <ToggleGroupItem value="matte" className="px-3 text-xs">
              {t("Mate")}
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingCard>

        <SettingCard
          title={t("Efectos")}
          desc={t("Desenfoque, grano y sombra.")}
          headerRight={
            <MiniCheck
              checked={fxSidebar}
              onChange={setFxSidebar}
              label={t("Incluye Sidebar")}
            />
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <LabeledRange
              label={t("Desenfoque")}
              value={blur}
              display={`${blur}`}
              min={0}
              max={40}
              step={1}
              onChange={setBlur}
              disabled={material === "solid"}
            />
            <LabeledRange
              label={t("Grano")}
              value={noise}
              display={`${Math.round(noise * 100)}`}
              min={0}
              max={0.5}
              step={0.01}
              onChange={setNoise}
              disabled={material !== "matte"}
            />
            <LabeledRange
              label={t("Sombra")}
              value={shadow}
              display={shadowNames[shadow] ?? t("Normal")}
              min={0}
              max={4}
              step={1}
              onChange={setShadow}
            />
          </div>
        </SettingCard>

        <SettingCard title={t("Tema de color")} span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {THEMES.map((t) => (
              <button
                key={t.name}
                onClick={() => setTheme(t.name)}
                className={cn(
                  "soft-hover relative flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  theme === t.name && "border-primary ring-1 ring-primary",
                )}
              >
                <span
                  className="size-4 shrink-0 rounded-full border"
                  style={{ background: t.swatch }}
                />
                <span className="truncate text-xs font-medium">{t.label}</span>
                {theme === t.name && (
                  <Check className="ml-auto size-3.5 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        </SettingCard>

        {/* Datos y caché — última opción, en una sola línea y a todo el ancho. */}
        <div
          data-slot="card"
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 md:col-span-2"
        >
          <span className="text-sm font-medium">{t("Datos y caché")}</span>
          <MiniCheck
            checked={cacheAuto}
            onChange={(v) => {
              setCacheAuto(v);
              setAutoRefreshEnabled(v);
            }}
            label={t("Auto-refresco cada 24 h")}
          />
        </div>
      </div>

      <p className="px-1 text-[11px] text-muted-foreground">
        ZodHub Pulse{u.currentVersion ? ` v${u.currentVersion}` : ""} ·{" "}
        {t("mantenimiento sencillo y honesto.")}
      </p>
    </div>
  );
}
