import { ExternalLink } from 'lucide-react';
import { useVersions } from '@/hooks/use-versions';
import { REPO_URL } from '@shared/constants';

/**
 * about.tsx - Página /about.
 * Muestra versión del wrapper + versión del proxy + link al repo.
 */
export const AboutPage = () => {
  const versions = useVersions();

  return (
    <div className="flex-1 p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground">Acerca de</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Wrapper desktop de <span className="font-mono">proxy-mapper</span> (MiniMax).
      </p>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Versiones</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Wrapper:</dt>
          <dd className="font-mono text-foreground">
            {versions ? `v${versions.wrapper}` : '…'}
          </dd>
          <dt className="text-muted-foreground">Proxy:</dt>
          <dd className="font-mono text-foreground">
            {versions ? `v${versions.proxy}` : '…'}
          </dd>
        </dl>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Repositorio</h2>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-sm text-info hover:underline break-all"
        >
          {REPO_URL}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      </section>
    </div>
  );
};
