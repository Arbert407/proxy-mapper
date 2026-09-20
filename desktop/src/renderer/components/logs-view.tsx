import { Copy, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogsStream } from '@/hooks/use-logs-stream';

/**
 * logs-view.tsx - Visor de logs en tiempo real.
 *
 * Layout: header sticky con acciones + área scrolleable monoespaciada sobre
 * fondo `slate-950`. Las acciones Limpiar/Copiar/Guardar se habilitan cuando
 * US-063/064/065 las implementen.
 */
export const LogsView = () => {
  const entries = useLogsStream();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-2 border-b border-border bg-card/40 px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold text-foreground mr-auto">
          Logs del proxy
        </h1>
        <Button variant="ghost" size="sm" disabled>
          <Trash2 className="h-4 w-4" /> Limpiar
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <Save className="h-4 w-4" /> Guardar
        </Button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-slate-300">
        {entries.length === 0 ? (
          <p className="text-muted-foreground italic">
            Esperando logs del proxy…
          </p>
        ) : (
          entries.map((e, i) => (
            <div key={`${e.timestamp}-${i}`}>
              <span className="text-slate-500">{e.timestamp}</span>{' '}
              {e.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
