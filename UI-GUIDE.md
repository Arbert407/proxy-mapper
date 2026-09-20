# UI-GUIDE.md - Guía de Diseño UI/UX

## Objetivo

Establecer estándares de diseño para el **wrapper desktop de `proxy-mapper`** con estilo **minimal + dark mode** (consistente con el visor de logs del proxy heredado). Todo se construye sobre **shadcn/ui** + **Tailwind CSS**.

---

## Paleta de Colores

### Colores Principales (semánticos del proyecto)

| Nombre | Token Tailwind | Hex | Uso |
|--------|---------------|-----|-----|
| **Off (rojo)** | `destructive` | `#DC2626` | Botón power cuando `state === 'off'` |
| **Running (verde)** | `success` | `#16A34A` | Botón power cuando `state === 'running'` |
| **Starting (ámbar)** | `warning` | `#F59E0B` | Botón power durante `starting` (spinner, no clickeable) |
| **Stopping (ámbar)** | `warning` | `#F59E0B` | Botón power durante `stopping` (spinner, no clickeable) |
| **Crashed (rojo fuerte)** | `destructive-dark` | `#991B1B` | Botón power durante `crashed` + halo |
| **Info (azul)** | `info` | `#3B82F6` | Toasts informativos |

### Colores Neutros (dark mode por defecto)

| Nombre | Token Tailwind | Hex | Uso |
|--------|---------------|-----|-----|
| **Background** | `background` | `#0F172A` (`slate-950`) | Fondo principal |
| **Surface** | `card` | `#1E293B` (`slate-900`) | Cards, sidebar, panels |
| **Surface elevated** | `popover` | `#334155` (`slate-800`) | Dropdowns, modals |
| **Text primary** | `foreground` | `#F8FAFC` (`slate-50`) | Texto principal |
| **Text secondary** | `muted-foreground` | `#94A3B8` (`slate-400`) | Labels, descripciones |
| **Text disabled** | `muted` | `#475569` (`slate-600`) | Items deshabilitados |
| **Border** | `border` | `#1E293B` (`slate-800`) | Bordes sutiles |

### Variables CSS (shadcn `globals.css`)

```css
@layer base {
  :root {
    /* shadcn tokens — dark mode por defecto */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 47.4% 11.2%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 47.4% 11.2%;
    --popover-foreground: 210 40% 98%;
    --primary: 142 71% 45%;      /* verde running */
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 72% 51%;     /* rojo off/crashed */
    --destructive-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --info: 217 91% 60%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 142 71% 45%;
    --radius: 0.5rem;
  }
}
```

---

## Colorización de Logs

Niveles detectados por regex en `desktop/src/main/logs.ts`:

| Nivel | Regex (sobre línea cruda) | Color UI | Ejemplo |
|-------|---------------------------|----------|---------|
| `error` | `\[ERROR\]` | `text-red-400` | `[2026-08-07T19:48Z] [ERROR] Invalid JSON` |
| `leak` | `!!! LEAK DETECTED !!!` | `text-red-500 font-bold` | `!!! LEAK DETECTED in REQUEST !!!` |
| `done` | `\[4/4\]` | `text-green-400` | `[4/4] RESPONSE TRANSFORMED total chunks: 12` |
| `warn` | `\[WARN\]` | `text-yellow-400` | `[2026-08-07T19:48Z] [WARN] retrying...` |
| `info` | resto | `text-slate-300` | `[2026-08-07T19:48Z] Mapping source: <path>` |

---

## Tipografía

### Familia de fuentes

- **Sans (UI)**: Inter, system-ui, -apple-system, sans-serif (default shadcn).
- **Mono (logs)**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.

### Jerarquía

| Elemento | Tamaño | Peso | Line Height | Uso |
|----------|--------|------|-------------|-----|
| H1 (página) | 24px (`text-2xl`) | 600 | 1.3 | Título de la vista |
| H2 (sección) | 20px (`text-xl`) | 600 | 1.4 | Subtítulos |
| H3 | 16px (`text-base`) | 500 | 1.5 | Headers de cards |
| Body | 14px (`text-sm`) | 400 | 1.5 | Texto general |
| Small / Label | 12px (`text-xs`) | 400 | 1.4 | Labels, footer |
| Mono (logs) | 13px | 400 | 1.4 | Líneas de log |

> **Nota:** las fuentes del visor de logs son más pequeñas (13px vs 14px) para maximizar densidad en línea, manteniendo la virtualización con `react-virtuoso`.

---

## Componentes UI

### Botón Power (componente custom: `power-button.tsx`)

```
+--------------------------+
|                          |
|       [icon Power]       |   80x80px (boton redondo)
|                          |
|       "Apagado"          |   texto dinamico
|                          |
+--------------------------+
```

- **Tamaño**: 128x128 px (área clickeable), icono 48x48.
- **Forma**: círculo (rounded-full).
- **Estado `off`**: bg `bg-red-600`, hover `bg-red-700`, halo `shadow-red-500/20`.
- **Estado `running`**: bg `bg-green-600`, hover `bg-green-700`, halo `shadow-green-500/20`.
- **Estado `starting | stopping`**: bg `bg-amber-500`, spinner interno, no clickeable.
- **Estado `crashed`**: bg `bg-red-900`, halo `shadow-red-500/40`, parpadeo suave (animación `pulse` de 2s).
- **Animación de transición**: crossfade de color en 300ms (Tailwind `transition-colors duration-300`).

### Botones estándar (shadcn)

| Variante | Uso | Background | Color texto |
|----------|-----|-----------|-------------|
| `default` | Acción primaria | `bg-primary` (verde) | `text-primary-foreground` |
| `destructive` | Acción peligrosa (Limpiar logs) | `bg-destructive` | `text-destructive-foreground` |
| `outline` | Acciones secundarias | transparent | `text-foreground` |
| `ghost` | Iconos sueltos (Copiar) | transparent | `text-muted-foreground` |
| `secondary` | Botón "Guardar" | `bg-secondary` | `text-secondary-foreground` |

### Sidebar (`app-sidebar.tsx`)

- **Ancho expandido**: 240 px.
- **Ancho colapsado**: 64 px (sólo iconos).
- **Items**: Inicio, Mappings, Logs, Acerca de.
- **Item activo**: bg `bg-secondary`, borde izquierdo 2px `border-primary`.
- **Item deshabilitado (proxy apagado)**: opacity 50%, `pointer-events-none`, cursor `not-allowed`.
- **Footer del sidebar**: versión `0.1.0` + link al repo, 12px, color `text-muted-foreground`.

### Visor de Logs (`logs-view.tsx`)

- **Layout**: header con acciones + área scrolleable.
- **Header**: 56 px de alto, fondo `bg-card`, borde inferior `border-b`.
- **Acciones** (en este orden): Filtro (input), Limpiar (destructive), Guardar (outline), Copiar (ghost).
- **Área scrolleable**: `flex-1`, fondo `bg-slate-950`, padding `p-4`, virtualizado con `Virtuoso`.
- **Fuente logs**: mono 13px, line-height 1.4, max-height por línea.
- **Auto-scroll**: scroll bottom cuando hay nuevas líneas Y `autoScroll === true`.
- **Botón de auto-scroll**: flotante abajo a la derecha cuando el usuario scrollea arriba, para volver al fondo.

### Cards (shadcn Card)

- Background `bg-card`.
- Border `border`.
- Border radius `rounded-lg`.
- Padding `p-4`.

### Toasts (shadcn Sonner)

- Posición: bottom-right.
- Tipos: `success` (verde), `error` (rojo), `info` (azul), `warning` (ámbar).
- Duración: 4s por defecto, 8s para errores.

### Agregar nuevos componentes shadcn

shadcn/ui **no es una dependencia npm**: se invoca bajo demanda con el CLI y los componentes se copian a `src/renderer/components/ui/`.

```bash
npx shadcn@latest add <nombre>
# ejemplos:
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add table
```

El CLI copia el componente + sus dependencias Radix a `components/ui/` y actualiza `globals.css` con los tokens necesarios.

---

## Animaciones

### Transiciones CSS

```css
/* tailwind.config.ts */
{
  transitionDuration: {
    '250': '250ms',
    '400': '400ms'
  },
  keyframes: {
    'pulse-crash': {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.6' }
    }
  },
  animation: {
    'pulse-crash': 'pulse-crash 2s ease-in-out infinite'
  }
}
```

### Micro-interacciones

- **Hover botones**: bg más claro (`hover:bg-{color}-700`).
- **Click botones**: `active:scale-[0.97]` (Tailwind built-in).
- **Botón power al cambiar estado**: `transition-all duration-300` con crossfade.
- **Crash state**: animación `animate-pulse-crash` infinita.
- **Loading**: spinner shadcn `Loader2` con `animate-spin`.

---

## Layout y Espaciado

### Container principal

- **Grid**: `grid-cols-[240px_1fr]` (sidebar + main).
- **Padding general**: `p-6` (24px).
- **Max width del main**: 100% del espacio restante.

### Espaciado (Tailwind scale)

| Nombre | Valor Tailwind | Uso |
|--------|---------------|-----|
| xs | `gap-1` (4px) | Entre icono y texto en items |
| sm | `gap-2` (8px) | Entre items del sidebar |
| md | `gap-4` (16px) | Entre secciones de una vista |
| lg | `gap-6` (24px) | Padding de cards |
| xl | `gap-8` (32px) | Entre header y content |

---

## Responsive

> La aplicación es de escritorio (mínimo 800x600). No se diseña para mobile.

### Breakpoints internos (si la ventana se redimensiona)

| Breakpoint | Ancho mínimo | Layout |
|------------|--------------|--------|
| `sm` | 800px | Sidebar 240 px + main |
| `md` | 1024px | Sidebar 240 px + main con más padding |
| `lg` | 1280px | Sidebar 280 px + main |

Por debajo de 800x600: mostrar mensaje "Resize la ventana".

---

## Accesibilidad

- **Focus visible**: outline 2px `outline-primary`, `outline-offset: 2px`.
- **Contraste**: WCAG AA mínimo. Texto sobre fondo:
  - `slate-50` sobre `slate-950` -> 16:1 ok
  - `slate-400` sobre `slate-900` -> 7:1 ok
  - `red-400` sobre `red-950` (texto error) -> 6:1 ok
- **Roles ARIA**: shadcn provee los correctos vía Radix (sidebar nav, button, dialog).
- **Navegación por teclado**:
  - `Tab` recorre el sidebar y los botones en orden lógico.
  - `Enter`/`Space` activa el botón power.
  - `Esc` cierra dialogs (Guardar, Acerca de).
- **Anuncios de estado** (opcional v2): usar `aria-live="polite"` para anunciar cambios de estado del proxy.

---

## Iconografía

| Icono (lucide-react) | Uso |
|---------------------|-----|
| `Power` | Botón power, sidebar Home |
| `Table` | Sidebar Mappings, ícono de la grilla de pares |
| `FileText` o `ScrollText` | Sidebar Logs |
| `Info` | Sidebar Acerca de |
| `Trash2` | Botón Limpiar logs |
| `Save` | Botón Guardar logs |
| `Copy` | Botón Copiar logs |
| `Filter` | Icono del input de filtro |
| `Loader2` | Spinner durante starting/stopping |
| `TriangleAlert` | Toast de error/crash |
| `CheckCircle2` | Toast de éxito |

---

## Próximos Pasos

1. Crear layout base (`App.tsx` con sidebar + outlet).
2. Implementar `PowerButton` con crossfade de color.
3. Implementar `AppSidebar` con colapso + estados disabled.
4. Implementar `LogsView` con virtualización + auto-scroll.
5. Implementar `MappingsView` con tabla editable (agregar / eliminar pares) + validación inline.
6. Validar accesibilidad con axe-core en dev.
7. (v2) Agregar toggle dark/light si se requiere.
