/**
 * mappings.tsx - Editor de pares `real` / `masked` del `mapping.tsv`.
 *
 * - US-092: tabla 2 columnas, "+" agrega fila, "x" elimina fila, auto-save al disco.
 * - US-093: validación inline — rechaza vacíos, tab/newline, duplicados.
 * - US-094 (pendiente): header con ruta absoluta del archivo.
 * - US-095: botones "Importar" / "Exportar" para mover mappings entre
 *   máquinas (TSV drop-in). El export escribe el mismo formato que
 *   `mapping.tsv`; el import filtra pares inválidos y reporta cuántos se
 *   descartaron. Si hay datos sin guardar, el import pide confirmación
 *   antes de reemplazar (los cambios pendientes se pierden).
 *
 * Decisiones:
 * - Auto-save con debounce de 300ms: evita spam de IPC en cada keystroke.
 * - Si hay errores de validación, NO se auto-guarda (los errores son inline
 *   y el usuario los ve directamente en la celda).
 * - Errores de auto-save (write del main): toast no bloqueante, usuario sigue editando.
 * - Import pide confirmación (`window.confirm`) si el estado en memoria
 *   difiere del último guardado en disco: previene pérdida silenciosa de
 *   cambios aún no flusheados por el debounce.
 */
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MappingPair } from '@shared/types';
import { countErrors, validateMappings } from '@shared/mappings-validation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const AUTO_SAVE_DEBOUNCE_MS = 300;

export const MappingsPage = () => {
  const [pairs, setPairs] = useState<MappingPair[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hidratación inicial desde disco (US-092 AC: ver el archivo real).
  useEffect(() => {
    const api = window.api?.mappings;
    if (!api) {
      setIsLoaded(true);
      return;
    }
    void api.read().then((result) => {
      if (result.ok && result.pairs) {
        setPairs(result.pairs);
      } else {
        toast.error('No se pudo leer mapping.tsv', {
          description: result.reason ?? 'Error desconocido',
        });
        setPairs([]);
      }
      setIsLoaded(true);
    });
  }, []);

  // US-093: validación derivada en cada cambio.
  const errors = useMemo(() => (pairs === null ? {} : validateMappings(pairs)), [pairs]);
  const errorCount = useMemo(() => countErrors(errors), [errors]);

  // Auto-save con debounce (US-092 AC: cambios persisten automáticamente).
  // US-093: se cancela si hay errores de validación (no escribimos pares inválidos).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!isLoaded || pairs === null) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (errorCount > 0) return;
    const timer = window.setTimeout(() => {
      const api = window.api?.mappings;
      if (!api) return;
      void api.write(pairs).then((result) => {
        if (!result.ok) {
          toast.error('No se pudo guardar mapping.tsv', {
            description: result.reason ?? 'Error desconocido',
          });
        }
      });
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pairs, isLoaded, errorCount]);

  const handleAdd = useCallback(() => {
    setPairs((prev) => [...(prev ?? []), { real: '', masked: '' }]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setPairs((prev) => (prev ?? []).filter((_, i) => i !== index));
  }, []);

  const handleChange = useCallback(
    (index: number, field: 'real' | 'masked', value: string) => {
      setPairs((prev) =>
        (prev ?? []).map((p, i) => (i === index ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  // US-095: export a un .tsv elegido vía diálogo nativo. Sin confirmación
  // porque es no-destructivo: el archivo destino no se sobreescribe a menos
  // que el usuario lo confirme en el propio diálogo de Windows.
  const handleExport = useCallback(() => {
    const api = window.api?.mappings;
    if (!api) return;
    const snapshot = pairs ?? [];
    if (snapshot.length === 0) {
      toast.info('No hay pares para exportar', {
        description: 'Agrega al menos un par antes de exportar.',
      });
      return;
    }
    void api.export(snapshot).then((result) => {
      if (result.ok) {
        toast.success('Mappings exportados', {
          description: `${snapshot.length} pares en ${result.path}`,
        });
      } else if (result.reason === 'canceled') {
        // No-op silencioso (mismo patrón que logs:save en US-064).
      } else {
        toast.error('No se pudo exportar el mappings', {
          description: result.reason ?? 'Error desconocido',
        });
      }
    });
  }, [pairs]);

  // US-095: import desde un .tsv. Pide confirmación si el editor tiene
  // cambios sin guardar (estado !== disco) — los cambios pendientes se
  // perderían al reemplazar `pairs`. El debounce de 300ms puede tener
  // una escritura en vuelo justo antes del confirm, pero el write es
  // best-effort: si falla, el import lo sobreescribe de todos modos
  // (decisión deliberada: el usuario ya confirmó que quiere reemplazar).
  const handleImport = useCallback(() => {
    const api = window.api?.mappings;
    if (!api) return;
    const hasUnsaved = (pairs?.length ?? 0) > 0;
    if (hasUnsaved) {
      const ok = window.confirm(
        'Vas a reemplazar los mappings actuales por los del archivo. ¿Continuar?',
      );
      if (!ok) return;
    }
    void api.import().then((result) => {
      if (!result.ok) {
        if (result.reason === 'canceled') return;
        if (result.reason === 'no_valid_pairs') {
          toast.error('El archivo no contiene pares válidos', {
            description: result.path,
          });
          return;
        }
        toast.error('No se pudo importar el mappings', {
          description: result.reason ?? 'Error desconocido',
        });
        return;
      }
      const incoming = result.pairs ?? [];
      setPairs(incoming);
      // El `useEffect` de auto-save va a flushear a disco en el próximo
      // ciclo (300ms). Si el usuario cierra la app antes, perderá el
      // import — aceptable porque ya confirmó el reemplazo.
      const skipped = result.skipped ?? 0;
      if (skipped > 0) {
        toast.warning(`Importados ${incoming.length} pares (${skipped} omitidos)`, {
          description: 'Revisa vacíos, duplicados o caracteres inválidos.',
        });
      } else {
        toast.success(`Importados ${incoming.length} pares`, {
          description: result.path,
        });
      }
    });
  }, [pairs]);

  if (!isLoaded || pairs === null) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cargando mapping.tsv…</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Mappings</h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleImport} size="sm" variant="ghost" title="Importar mappings desde un .tsv">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={handleExport} size="sm" variant="ghost" title="Exportar mappings a un .tsv">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleAdd} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Agregar par
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {pairs.length === 0
            ? 'Sin pares. Pulsa "Agregar par" para empezar.'
            : `${pairs.length} par${pairs.length === 1 ? '' : 'es'}.`}
        </span>
        {errorCount > 0 ? (
          <span className="text-destructive font-medium">
            {errorCount} error{errorCount === 1 ? '' : 'es'} — corrije antes de guardar
          </span>
        ) : (
          <span className="text-muted-foreground">Cambios se guardan automáticamente</span>
        )}
      </div>

      <div className="flex-1 overflow-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/2">
                real
              </th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/2">
                masked
              </th>
              <th className="w-10" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, idx) => {
              const err = errors[idx];
              const realErr = err?.real;
              const maskedErr = err?.masked;
              return (
                <tr key={idx} className="border-t border-border align-top">
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={pair.real}
                      onChange={(e) => handleChange(idx, 'real', e.target.value)}
                      placeholder="Texto confidencial"
                      spellCheck={false}
                      autoComplete="off"
                      aria-invalid={realErr ? true : undefined}
                      className={cn(
                        'w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 rounded-sm border border-transparent px-1 -mx-1 focus-visible:border-ring',
                        realErr && 'border-destructive bg-destructive/5',
                      )}
                    />
                    {realErr && (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {realErr}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={pair.masked}
                      onChange={(e) => handleChange(idx, 'masked', e.target.value)}
                      placeholder="Versión enmascarada"
                      spellCheck={false}
                      autoComplete="off"
                      aria-invalid={maskedErr ? true : undefined}
                      className={cn(
                        'w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 rounded-sm border border-transparent px-1 -mx-1 focus-visible:border-ring',
                        maskedErr && 'border-destructive bg-destructive/5',
                      )}
                    />
                    {maskedErr && (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {maskedErr}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      aria-label={`Eliminar par ${idx + 1}`}
                      title="Eliminar par"
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
