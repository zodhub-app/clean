import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { THEMES, type Mode, type ThemeName } from "@/lib/themes";

// Tema por defecto al abrir por primera vez (hasta que el usuario lo cambie en
// Ajustes): "Elegant Luxury". Si no existiera, cae a otro disponible.
const DEFAULT_THEME: ThemeName = THEMES.some((t) => t.name === "elegant-luxury")
  ? "elegant-luxury"
  : (THEMES[0]?.name ?? ("twitter" as ThemeName));
const DEFAULT_SCALE = 1;
const DEFAULT_MATERIAL: Material = "matte";

export type Skin = "none" | "zeus" | "hera";
export type Background = "none" | "gradient" | "aurora";
export type Material = "solid" | "glass" | "matte";

const DEFAULT_BLUR = 25; // px
const DEFAULT_NOISE = 0.25; // 0..1
const DEFAULT_SHADOW = 3; // 0..4 (Fuerte)

type ThemeState = {
  theme: ThemeName;
  mode: Mode;
  resolvedMode: "light" | "dark";
  scale: number;
  skin: Skin;
  bg: Background;
  material: Material;
  blur: number;
  noise: number;
  shadow: number;
  fxSidebar: boolean;
  heraFiligree: boolean;
  smoothScroll: boolean;
  setTheme: (t: ThemeName) => void;
  setMode: (m: Mode) => void;
  setScale: (s: number) => void;
  setSkin: (s: Skin) => void;
  setBg: (b: Background) => void;
  setMaterial: (m: Material) => void;
  setBlur: (n: number) => void;
  setNoise: (n: number) => void;
  setShadow: (n: number) => void;
  setFxSidebar: (b: boolean) => void;
  setHeraFiligree: (b: boolean) => void;
  setSmoothScroll: (b: boolean) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const THEME_KEY = "macup.theme";
const MODE_KEY = "macup.mode";
const SCALE_KEY = "macup.scale";
const SKIN_KEY = "macup.skin";
const BG_KEY = "macup.bg";
const MATERIAL_KEY = "macup.material";
const BLUR_KEY = "macup.blur";
const NOISE_KEY = "macup.noise";
const SHADOW_KEY = "macup.shadow";
const FXSIDEBAR_KEY = "macup.fxSidebar";
const FILIGREE_KEY = "macup.heraFiligree";
const SMOOTH_KEY = "macup.smoothScroll";

function prefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemeName | null;
    return stored && THEMES.some((t) => t.name === stored)
      ? stored
      : DEFAULT_THEME;
  });
  const [mode, setModeState] = useState<Mode>(
    () => (localStorage.getItem(MODE_KEY) as Mode) || "system",
  );
  const [scale, setScaleState] = useState<number>(() => {
    const s = Number(localStorage.getItem(SCALE_KEY));
    return Number.isFinite(s) && s > 0 ? s : DEFAULT_SCALE;
  });
  const [skin, setSkinState] = useState<Skin>(
    () => (localStorage.getItem(SKIN_KEY) as Skin) || "none",
  );
  const [bg, setBgState] = useState<Background>(
    () => (localStorage.getItem(BG_KEY) as Background) || "none",
  );
  const [material, setMaterialState] = useState<Material>(
    () => (localStorage.getItem(MATERIAL_KEY) as Material) || DEFAULT_MATERIAL,
  );
  const [blur, setBlurState] = useState<number>(() => {
    const n = Number(localStorage.getItem(BLUR_KEY));
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_BLUR;
  });
  const [noise, setNoiseState] = useState<number>(() => {
    const n = Number(localStorage.getItem(NOISE_KEY));
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_NOISE;
  });
  const [shadow, setShadowState] = useState<number>(() => {
    const n = Number(localStorage.getItem(SHADOW_KEY));
    return Number.isFinite(n) && n >= 0 && n <= 4 ? n : DEFAULT_SHADOW;
  });
  const [fxSidebar, setFxSidebarState] = useState<boolean>(
    () => localStorage.getItem(FXSIDEBAR_KEY) === "1",
  );
  const [heraFiligree, setHeraFiligreeState] = useState<boolean>(
    () => localStorage.getItem(FILIGREE_KEY) === "1",
  );
  // Desplazamiento suave (Lenis): activado por defecto.
  const [smoothScroll, setSmoothScrollState] = useState<boolean>(
    () => localStorage.getItem(SMOOTH_KEY) !== "0",
  );
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Aplica el estilo por defecto del proyecto UNA vez (para equipos con ajustes
  // antiguos guardados). Después respeta lo que el usuario cambie.
  useEffect(() => {
    if (localStorage.getItem("macup.defaultsV") === "1") return;
    setThemeState(DEFAULT_THEME);
    localStorage.setItem(THEME_KEY, DEFAULT_THEME);
    setSkinState("none");
    localStorage.setItem(SKIN_KEY, "none");
    setMaterialState(DEFAULT_MATERIAL);
    localStorage.setItem(MATERIAL_KEY, DEFAULT_MATERIAL);
    setBlurState(DEFAULT_BLUR);
    localStorage.setItem(BLUR_KEY, String(DEFAULT_BLUR));
    setNoiseState(DEFAULT_NOISE);
    localStorage.setItem(NOISE_KEY, String(DEFAULT_NOISE));
    setShadowState(DEFAULT_SHADOW);
    localStorage.setItem(SHADOW_KEY, String(DEFAULT_SHADOW));
    localStorage.setItem("macup.defaultsV", "1");
  }, []);

  // Track OS appearance changes when mode === "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

  // Apply theme + appearance to <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", resolvedMode === "dark");
  }, [theme, resolvedMode]);

  // Apply global UI scale via zoom (supported in WKWebView).
  useEffect(() => {
    (document.documentElement.style as CSSStyleDeclaration & {
      zoom?: string;
    }).zoom = String(scale);
  }, [scale]);

  // Apply surface skin (Zeus / Hera) to <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (skin === "none") root.removeAttribute("data-skin");
    else root.setAttribute("data-skin", skin);
  }, [skin]);

  // Apply background + card material options to <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (bg === "none") root.removeAttribute("data-bg");
    else root.setAttribute("data-bg", bg);
  }, [bg]);

  useEffect(() => {
    const root = document.documentElement;
    if (material === "solid") root.removeAttribute("data-material");
    else root.setAttribute("data-material", material);
  }, [material]);

  // Blur strength + noise opacity as CSS vars (driven by the sliders).
  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--macup-blur", `${blur}px`);
    s.setProperty("--macup-noise", String(noise));
  }, [blur, noise]);

  // Shadow level (0..4) as a CSS var so every surface (incl. skins) reacts.
  useEffect(() => {
    const SHADOWS = [
      "none",
      "0 1px 2px rgba(0,0,0,.10), 0 1px 3px rgba(0,0,0,.08)",
      "0 4px 10px -2px rgba(0,0,0,.16), 0 2px 4px -2px rgba(0,0,0,.12)",
      "0 12px 26px -6px rgba(0,0,0,.30), 0 4px 8px -4px rgba(0,0,0,.18)",
      "0 22px 48px -10px rgba(0,0,0,.45), 0 8px 18px -8px rgba(0,0,0,.30)",
    ];
    document.documentElement.style.setProperty(
      "--macup-shadow",
      SHADOWS[shadow] ?? SHADOWS[2],
    );
  }, [shadow]);

  // Extend card effects (glass/matte) to the sidebar + header when enabled.
  useEffect(() => {
    const root = document.documentElement;
    if (fxSidebar) root.setAttribute("data-fx-sidebar", "1");
    else root.removeAttribute("data-fx-sidebar");
  }, [fxSidebar]);

  // Filigrana (hairlines finas) sobre el skin Hera cuando se activa.
  useEffect(() => {
    const root = document.documentElement;
    if (heraFiligree) root.setAttribute("data-hera-filigree", "1");
    else root.removeAttribute("data-hera-filigree");
  }, [heraFiligree]);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      mode,
      resolvedMode,
      scale,
      skin,
      bg,
      material,
      blur,
      noise,
      shadow,
      fxSidebar,
      heraFiligree,
      smoothScroll,
      setTheme: (t) => {
        setThemeState(t);
        localStorage.setItem(THEME_KEY, t);
      },
      setMode: (m) => {
        setModeState(m);
        localStorage.setItem(MODE_KEY, m);
      },
      setScale: (s) => {
        setScaleState(s);
        localStorage.setItem(SCALE_KEY, String(s));
      },
      setSkin: (s) => {
        setSkinState(s);
        localStorage.setItem(SKIN_KEY, s);
      },
      setBg: (b) => {
        setBgState(b);
        localStorage.setItem(BG_KEY, b);
      },
      setMaterial: (m) => {
        setMaterialState(m);
        localStorage.setItem(MATERIAL_KEY, m);
      },
      setBlur: (n) => {
        setBlurState(n);
        localStorage.setItem(BLUR_KEY, String(n));
      },
      setNoise: (n) => {
        setNoiseState(n);
        localStorage.setItem(NOISE_KEY, String(n));
      },
      setShadow: (n) => {
        setShadowState(n);
        localStorage.setItem(SHADOW_KEY, String(n));
      },
      setFxSidebar: (b) => {
        setFxSidebarState(b);
        localStorage.setItem(FXSIDEBAR_KEY, b ? "1" : "0");
      },
      setHeraFiligree: (b) => {
        setHeraFiligreeState(b);
        localStorage.setItem(FILIGREE_KEY, b ? "1" : "0");
      },
      setSmoothScroll: (b) => {
        setSmoothScrollState(b);
        localStorage.setItem(SMOOTH_KEY, b ? "1" : "0");
      },
    }),
    [
      theme,
      mode,
      resolvedMode,
      scale,
      skin,
      bg,
      material,
      blur,
      noise,
      shadow,
      fxSidebar,
      heraFiligree,
      smoothScroll,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
