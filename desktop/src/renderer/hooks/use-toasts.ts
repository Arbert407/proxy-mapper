/**
 * use-toasts.ts - Hook que suscribe a `toastStore`.
 *
 * Devuelve el array actual de toasts activos y se re-renderiza ante cambios.
 */
import { useSyncExternalStore } from 'react';
import { toastStore, type Toast } from '@/lib/toast';

export const useToasts = (): Toast[] =>
  useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
