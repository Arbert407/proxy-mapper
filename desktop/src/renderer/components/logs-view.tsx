/**
 * logs-view.tsx - Visor de logs en tiempo real del proxy.
 *
 * - US-060: render en tiempo real con fondo `slate-950` y fuente mono.
 * - US-061: auto-scroll al fondo + botón flotante para volver.
 * - US-062: buffer FIFO 5000 en main (lectura vía `getLogsBuffer`).
 * - US-063: limpiar buffer (renderer + main), con confirmación si > 100 líneas.
 * - US-064: guardar buffer completo a .txt vía `dialog.showSaveDialog`.
 * - US-065: copiar buffer completo al portapapeles (navigator.clipboard).
 * - US-066: filtro case-insensitive sobre `entry.message` (cliente puro).
 * - US-067: colorización por `entry.level` (clasificado en main por parseLogLevel).
 * - US-068: virtualización con `react-virtuoso` para fluidez con miles de líneas.
 *
 * Decisión clave: "Guardar" y "Copiar" operan sobre el buffer COMPLETO
 * (entries), no sobre la vista filtrada — el filtro es para inspección, no
 * para archivar. Documentado en US-066 Notas Técnicas.
 */
import { ArrowDown, Copy, Filter, Save, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { LogEntry, LogLevel } from '@shared/types';
import { Button } from '@/components/ui/button';
import { useLogsStream } from '@/hooks/use-logs-stream';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const CLEAR_CONFIRM_THRESHOLD = 100;

const LEVEL_CLASS: Record<LogLevel, string> = {
  error: 'text-red-400',
  leak: 'text-red-500 font-bold',
  warn: 'text-yellow-400',
  done: 'text-green-400',
  info: 'text-slate-300',
};

interface LogLineProps {
  entry: LogEntry;
  rowIndex: number;
}

const LogLine = ({ entry, rowIndex }: LogLineProps) => (
  <div className="px-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
    <span className="text-slate-500 select-none mr-3 tabular-nums">{rowIndex + 1}</span>
    <span className="text-slate-500">{entry.timestamp}</span>{' '}
    <span className={LEVEL_CLASS[entry.level]}>{entry.message}</span>
  </div>
);

export const LogsView = () => {
  const { entries, clear } = useLogsStream();
  const [filter, setFilter] = useState('');
  const [showJumpButton, setShowJumpButton] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const filtered = useMemo(() => {
    if (!filter) return entries;
    const needle = filter.toLowerCase();
    return entries.filter((e) => e.message.toLowerCase().includes(needle));
  }, [entries, filter]);

  const handleJumpToBottom = useCallback(() => {
    if (filtered.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: filtered.length - 1,
      behavior: 'smooth',
      align: 'end',
    });
  }, [filtered.length]);

  const handleClear = useCallback(async () => {
    if (entries.length > CLEAR_CONFIRM_THRESHOLD) {
      const ok = window.confirm(
        `¿Vaciar ${entries.length} líneas del buffer de logs?\n` +
          'El archivo app.log en disco NO se modifica.',
      );
      if (!ok) return;
    }
    clear();
    try {
      const result = await window.api?.logs.clear();
      if (result && !result.ok) {
        toast.warning('Buffer local vaciado, pero main rechazó clear', {
          description: 'Revisa app.log para detalles.',
        });
      }
    } catch (err) {
      toast.error('No se pudo limpiar el buffer en main', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [entries.length, clear]);

  const handleSave = useCallback(async () => {
    try {
      const result = await window.api?.logs.save();
      if (!result) return;
      if (result.ok) {
        toast.success('Logs guardados', { description: result.path });
      } else if (result.reason !== 'canceled') {
        toast.error('No se pudieron guardar los logs', {
          description: result.reason,
        });
      }
    } catch (err) {
      toast.error('No se pudieron guardar los logs', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (entries.length === 0) return;
    const text = entries.map((e) => `${e.timestamp} ${e.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado', {
        description: `${entries.length} líneas al portapapeles`,
      });
    } catch (err) {
      toast.error('No se pudo copiar', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [entries]);

  const isFilteredEmpty = filtered.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-2 border-b border-border bg-card/40 px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold text-foreground mr-auto">
          Logs del proxy
        </h1>
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            aria-label="Filtrar logs"
            className="h-8 w-48 rounded-md border border-input bg-background pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={entries.length === 0}
        >
          <Trash2 className="h-4 w-4" /> Limpiar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={entries.length === 0}
        >
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={entries.length === 0}
        >
          <Save className="h-4 w-4" /> Guardar
        </Button>
      </header>
      <div className="relative flex-1 min-h-0 bg-slate-950">
        <Virtuoso
          ref={virtuosoRef}
          data={filtered}
          followOutput="auto"
          atBottomStateChange={(atBottom) => setShowJumpButton(!atBottom)}
          computeItemKey={(index) => String(index)}
          itemContent={(index, e) => <LogLine entry={e} rowIndex={index} />}
          components={{
            EmptyPlaceholder: () => (
              <div className="flex items-center justify-center h-full p-4 text-muted-foreground italic font-mono text-xs">
                {filter ? 'Sin coincidencias' : 'Esperando logs del proxy…'}
              </div>
            ),
          }}
          className="h-full"
        />
        <button
          type="button"
          onClick={handleJumpToBottom}
          aria-label="Volver al final del log"
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 px-3 h-9 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-medium',
            showJumpButton && !isFilteredEmpty
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none',
          )}
        >
          <ArrowDown className="h-3.5 w-3.5" /> Volver al final
        </button>
      </div>
    </div>
  );
};
