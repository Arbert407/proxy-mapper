/**
 * use-versions.ts - Lee versiones del wrapper y del proxy vía IPC.
 *
 * Devuelve `{ wrapper: string; proxy: string }` o `null` mientras carga.
 * Cachea el resultado: sólo se hace una llamada IPC por sesión.
 */
import { useEffect, useState } from 'react';

const FALLBACK = { wrapper: '0.0.0', proxy: '0.0.0' };

export const useVersions = (): { wrapper: string; proxy: string } | null => {
  const [versions, setVersions] = useState<{ wrapper: string; proxy: string } | null>(null);

  useEffect(() => {
    const api = window.api?.app;
    if (!api) {
      setVersions(FALLBACK);
      return;
    }
    let cancelled = false;
    api
      .getVersion()
      .then((v) => {
        if (!cancelled) setVersions(v);
      })
      .catch(() => {
        if (!cancelled) setVersions(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return versions;
};
