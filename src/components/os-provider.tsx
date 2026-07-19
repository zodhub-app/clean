import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { osName } from "@/lib/api";
import { setByteBase } from "@/lib/format";

/**
 * Sistema operativo en el que corre la app. Sirve para dos cosas:
 *   1. Adaptar los textos («tu Mac» / «tu PC» / «tu equipo»).
 *   2. Ocultar las secciones que no existen en ese sistema, en vez de mostrar
 *      pantallas vacías o botones que no hacen nada (principio de honestidad).
 */
export type Os = "macos" | "windows" | "linux" | "unknown";

const Context = createContext<Os>("unknown");

export function OsProvider({ children }: { children: ReactNode }) {
  const [os, setOs] = useState<Os>("unknown");

  useEffect(() => {
    osName()
      .then((v) => {
        if (v === "macos" || v === "windows" || v === "linux") {
          setOs(v);
          // Cada sistema escribe «GB» con una base distinta. Se fija aquí,
          // antes de pintar ninguna cifra, para que los tamaños coincidan con
          // el Finder o el Explorador del usuario (ver lib/format.ts).
          setByteBase(v);
        }
      })
      .catch(() => setOs("unknown"));
  }, []);

  return <Context.Provider value={os}>{children}</Context.Provider>;
}

export function useOs(): Os {
  return useContext(Context);
}

/** Nombre del equipo según el sistema, para usar dentro de las frases. */
export function deviceNoun(os: Os): string {
  if (os === "macos") return "Mac";
  if (os === "windows") return "PC";
  return "equipo";
}
