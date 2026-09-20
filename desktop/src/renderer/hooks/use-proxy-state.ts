/**
 * use-proxy-state.ts - Hook que sincroniza el renderer con el estado del proxy.
 *
 * Suscribe a `proxy:state` IPC y expone `{ state, reason }` reactivo.
 * Devuelve el último estado conocido: arranca en `initial` y se actualiza ante
 * cada evento del main process.
 */
import { useEffect, useState } from 'react';
import type { ProxyState, ProxyStateChange } from '@shared/types';

export interface ProxyStateInfo {
  state: ProxyState;
  reason?: string;
}

export const useProxyState = (initial: ProxyState = 'off'): ProxyStateInfo => {
  const [info, setInfo] = useState<ProxyStateInfo>({ state: initial });

  useEffect(() => {
    const api = window.api?.proxy;
    if (!api) return;
    const unsubscribe = api.onStateChange((change: ProxyStateChange) => {
      setInfo({ state: change.state, reason: change.reason });
    });
    return unsubscribe;
  }, []);

  return info;
};
