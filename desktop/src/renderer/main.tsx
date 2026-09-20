import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppSidebar } from './components/app-sidebar';
import { Toaster } from './components/ui/toaster';
import { HomePage } from './pages/home';
import { MappingsPage } from './pages/mappings';
import { LogsPage } from './pages/logs';
import { AboutPage } from './pages/about';
import { toast } from './lib/toast';
import { useProxyState } from './hooks/use-proxy-state';
import './styles/globals.css';

const CRASH_AUTO_RESET_MS = 4000;

function App() {
  const [collapsed, setCollapsed] = React.useState(false);
  const { state, reason } = useProxyState();
  const lastSeenStateRef = useRef(state);

  useEffect(() => {
    if (state === 'crashed' && lastSeenStateRef.current !== 'crashed') {
      toast.error('Proxy cayó', {
        description:
          reason ?? 'El proceso proxy terminó inesperadamente. Revisa los logs.',
      });
    }
    lastSeenStateRef.current = state;
  }, [state, reason]);

  useEffect(() => {
    if (state !== 'crashed') return undefined;
    const timer = window.setTimeout(() => {
      // Best-effort: pedir al main que vuelva a 'off'. Si el main ya emitió
      // 'off' por su cuenta, esto será un no-op.
      window.api?.proxy.stop().catch(() => {});
    }, CRASH_AUTO_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const handleToggle = () => {
    const api = window.api?.proxy;
    if (!api) return;
    if (state === 'off' || state === 'crashed') {
      api.start();
    } else if (state === 'running') {
      api.stop();
    }
  };

  // Sidebar habilitado cuando el proxy está operativo (running) o caído (ver logs).
  const sidebarDisabled = state !== 'running' && state !== 'crashed';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        disabled={sidebarDisabled}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route
            path="/"
            element={<HomePage state={state} onToggle={handleToggle} />}
          />
          <Route path="/mappings" element={<MappingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
}
