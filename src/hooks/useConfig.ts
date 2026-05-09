import { useCallback, useEffect, useState } from 'react';
import type { WidgetConfigParsed } from '@/types/widget';

export function useConfig() {
  const [config, setConfig] = useState<WidgetConfigParsed | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/config', { credentials: 'include' });
      if (!r.ok) throw new Error('config');
      const j = (await r.json()) as { config: WidgetConfigParsed };
      setConfig(j.config);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { config, loading, reload };
}
