import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"
import Lenis from "lenis"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

function ScrollArea({
  className,
  children,
  type = "scroll",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const { smoothScroll } = useTheme()

  // Desplazamiento suave con inercia (Lenis). Mantiene el scroll NATIVO (anima
  // scrollTop, no usa transform), así el cristal de Hera, las cabeceras fijas y
  // los scrollbars temáticos siguen funcionando. Se activa/desactiva en Ajustes.
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el || !smoothScroll) return
    const content = (el.firstElementChild as HTMLElement | null) ?? el
    const lenis = new Lenis({
      wrapper: el,
      content,
      duration: 0.85,
      easing: (t: number) => 1 - Math.pow(1 - t, 3), // easeOutCubic
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    })

    // rAF SOLO mientras se desplaza; en reposo no gasta nada (evita el bucle
    // perpetuo que hacía sentir la app pesada).
    let raf = 0
    let running = false
    const loop = (time: number) => {
      lenis.raf(time)
      if (lenis.isScrolling) {
        raf = requestAnimationFrame(loop)
      } else {
        running = false
      }
    }
    const kick = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(loop)
      }
    }
    el.addEventListener("wheel", kick, { passive: true })
    el.addEventListener("touchstart", kick, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("wheel", kick)
      el.removeEventListener("touchstart", kick)
      lenis.destroy()
    }
  }, [smoothScroll])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      type={type}
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-1.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-1.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
