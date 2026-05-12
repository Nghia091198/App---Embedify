import { useCallback, useEffect, useState } from 'react';
import type { WidgetConfigParsed } from '@/types/widget';

export type ReloadConfigOptions = { silent?: boolean };

export function useConfig() {
  const [config, setConfig] = useState<WidgetConfigParsed | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (opts?: ReloadConfigOptions) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/admin/config', { credentials: 'include' });
      if (!r.ok) throw new Error('config');
      const j = (await r.json()) as { config: WidgetConfigParsed };
      setConfig(j.config);
    } catch {
      if (!silent) setConfig(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { config, loading, reload };
}
