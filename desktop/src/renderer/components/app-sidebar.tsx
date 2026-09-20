/**
 * app-sidebar.tsx - Barra lateral de navegación colapsable.
 *
 * Features:
 * - 4 items (Inicio / Mappings / Logs / Acerca de) con icono Lucide + label.
 * - Colapsable a 64px (sólo iconos) / expandido a 240px.
 * - Item activo resaltado con `bg-secondary` + borde izquierdo `border-primary`.
 * - Estado disabled global: opacity 50% + pointer-events-none (proxy apagado).
 * - Footer con versiones del wrapper y del proxy (12px, muted-foreground).
 */
import { NavLink } from 'react-router-dom';
import { Power, Table, FileText, Info, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVersions } from '@/hooks/use-versions';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  disabled: boolean;
}

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Inicio', Icon: Power, end: true },
  { to: '/mappings', label: 'Mappings', Icon: Table },
  { to: '/logs', label: 'Logs', Icon: FileText },
  { to: '/about', label: 'Acerca de', Icon: Info },
];

export const AppSidebar = ({ collapsed, onToggle, disabled }: AppSidebarProps) => {
  const versions = useVersions();

  return (
    <aside
      className={cn(
        'flex flex-col bg-card border-r border-border transition-[width] duration-250 ease-out shrink-0',
        collapsed ? 'w-16' : 'w-60',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed'
      )}
      aria-disabled={disabled}
    >
      <div className="flex items-center p-2 border-b border-border min-h-[48px]">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!collapsed}
          className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        {!collapsed && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground ml-2">
            Menú
          </span>
        )}
      </div>
      <nav className="flex-1 p-2 flex flex-col gap-1" aria-label="Navegación principal">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border-l-2 border-transparent',
                isActive && 'bg-secondary text-foreground border-l-primary font-medium',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
      {versions && !collapsed && (
        <div className="p-3 border-t border-border text-xs text-muted-foreground space-y-0.5">
          <p className="truncate" title={`Wrapper v${versions.wrapper}`}>
            Wrapper v{versions.wrapper}
          </p>
          <p className="truncate" title={`Proxy v${versions.proxy}`}>
            Proxy v{versions.proxy}
          </p>
        </div>
      )}
    </aside>
  );
};
