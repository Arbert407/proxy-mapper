import { PowerButton } from '@/components/power-button';
import { PROXY_PORT } from '@shared/constants';
import type { ProxyState } from '@shared/types';

interface HomePageProps {
  state: ProxyState;
  onToggle: () => void;
}

const STATE_LABELS: Record<ProxyState, string> = {
  off: 'Apagado',
  starting: 'Arrancando…',
  running: 'Corriendo',
  stopping: 'Deteniendo…',
  crashed: 'Caído',
};

/**
 * home.tsx - Vista principal: botón power, estado legible y puerto.
 */
export const HomePage = ({ state, onToggle }: HomePageProps) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
    <PowerButton state={state} onToggle={onToggle} />
    <dl className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <dt>Estado:</dt>
        <dd className="font-mono text-foreground">{STATE_LABELS[state]}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>Puerto:</dt>
        <dd className="font-mono text-foreground">:{PROXY_PORT}</dd>
      </div>
    </dl>
  </div>
);
