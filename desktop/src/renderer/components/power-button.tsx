import { Power, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import type { ProxyState } from '@shared/types';

interface PowerButtonProps {
  state: ProxyState;
  onToggle: () => void;
}

const STATE_STYLES: Record<ProxyState, string> = {
  off: 'bg-destructive hover:bg-destructive/90 shadow-lg shadow-red-500/20',
  starting: 'bg-warning hover:bg-warning/90',
  stopping: 'bg-warning hover:bg-warning/90',
  running: 'bg-success hover:bg-success/90 shadow-lg shadow-green-500/20',
  crashed: 'bg-destructive-dark hover:bg-destructive-dark/90 shadow-lg shadow-red-500/40 animate-pulse-crash',
};

const STATE_LABELS: Record<ProxyState, string> = {
  off: 'Apagado',
  starting: 'Arrancando...',
  stopping: 'Deteniendo...',
  running: 'Corriendo',
  crashed: 'Crashed',
};

export const PowerButton = ({ state, onToggle }: PowerButtonProps) => {
  const isTransitioning = state === 'starting' || state === 'stopping';
  return (
    <Button
      onClick={onToggle}
      disabled={isTransitioning}
      aria-label={`Estado: ${STATE_LABELS[state]}`}
      className={`h-32 w-32 rounded-full flex-col gap-2 transition-all duration-300 ${STATE_STYLES[state]}`}
    >
      {isTransitioning ? (
        <Loader2 className="h-12 w-12 animate-spin" />
      ) : (
        <Power className="h-12 w-12" strokeWidth={2.5} />
      )}
      <span className="text-sm font-medium">{STATE_LABELS[state]}</span>
    </Button>
  );
};
