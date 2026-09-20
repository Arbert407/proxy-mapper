/**
 * toast.ts - Sistema de toasts del wrapper desktop.
 *
 * Store externo (sin React) + helpers `toast.error/info/...` consumidos por
 * cualquier componente. El `<Toaster />` se suscribe via `useSyncExternalStore`.
 *
 * Diseño:
 * - Sin dependencias externas (CSP estricta: nada de `unsafe-inline`).
 * - IDs auto-generados; auto-dismiss por duración.
 * - Variantes: success / error / info / warning.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

export interface Toast extends Required<Omit<ToastInput, 'description'>> {
  id: string;
  description?: string;
}

type Listener = (toasts: Toast[]) => void;

const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 8000;

class ToastStore {
  private toasts: Toast[] = [];
  private listeners: Set<Listener> = new Set();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Toast[] => this.toasts;

  push(input: ToastInput): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration =
      input.duration ?? (input.variant === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
    const toast: Toast = {
      id,
      variant: input.variant,
      title: input.title,
      description: input.description,
      duration,
    };
    this.toasts = [...this.toasts, toast];
    this.emit();
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  dismiss(id: string): void {
    const next = this.toasts.filter((t) => t.id !== id);
    if (next.length !== this.toasts.length) {
      this.toasts = next;
      this.emit();
    }
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.toasts));
  }
}

export const toastStore = new ToastStore();

export const toast = {
  success: (title: string, opts?: Omit<ToastInput, 'variant' | 'title'>) =>
    toastStore.push({ ...opts, variant: 'success', title }),
  error: (title: string, opts?: Omit<ToastInput, 'variant' | 'title'>) =>
    toastStore.push({ ...opts, variant: 'error', title }),
  info: (title: string, opts?: Omit<ToastInput, 'variant' | 'title'>) =>
    toastStore.push({ ...opts, variant: 'info', title }),
  warning: (title: string, opts?: Omit<ToastInput, 'variant' | 'title'>) =>
    toastStore.push({ ...opts, variant: 'warning', title }),
};

export const dismissToast = (id: string): void => toastStore.dismiss(id);
