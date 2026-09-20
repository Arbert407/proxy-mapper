/**
 * toaster.tsx - Contenedor de toasts (bottom-right).
 *
 * Renderiza la lista activa desde `toastStore`. Se monta una sola vez en la
 * raíz del renderer (`<Toaster />`). Sin estilos inline: todas las clases
 * pasan por Tailwind para respetar la CSP estricta (US-013).
 */
import { CheckCircle2, Info, TriangleAlert, AlertTriangle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToasts } from '@/hooks/use-toasts';
import { dismissToast, type ToastVariant } from '@/lib/toast';
import { cn } from '@/lib/utils';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  error: 'border-destructive/60 bg-destructive/15',
  success: 'border-success/60 bg-success/15',
  info: 'border-info/60 bg-info/15',
  warning: 'border-warning/60 bg-warning/15',
};

const VARIANT_ICON_STYLES: Record<ToastVariant, string> = {
  error: 'text-destructive',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
};

const VARIANT_ICONS: Record<ToastVariant, LucideIcon> = {
  error: TriangleAlert,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

export const Toaster = () => {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = VARIANT_ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-start gap-3 min-w-80 max-w-md p-3 rounded-md border shadow-lg backdrop-blur bg-card/95 transition-all duration-250',
              VARIANT_STYLES[t.variant]
            )}
          >
            <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', VARIANT_ICON_STYLES[t.variant])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Cerrar notificación"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
