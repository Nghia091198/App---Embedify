import { useEffect, useState } from 'react';
import { MainPage } from '@/pages/MainPage';
import { SettingsTab } from '@/components/settings/SettingsTab';

type Me = {
  orgid?: string | null;
  orgname?: string | null;
  name?: string | null;
  email?: string | null;
};

export function App() {
  const [tab, setTab] = useState<'content' | 'settings'>('content');
  const [me, setMe] = useState<Me | null | false>(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        if (!r.ok) {
          if (!cancelled) setMe(null);
          return;
        }
        const j = (await r.json()) as Me;
        if (!cancelled) setMe(j);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (me === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Đang tải…</p>
      </div>
    );
  }

  if (!me?.orgid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-center text-slate-600">Đăng nhập Haravan để quản lý block sản phẩm.</p>
        <a
          href="/api/auth/install"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1d9e75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Cài đặt / Đăng nhập
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#1d9e75]">widgets</span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Widget Block sản phẩm</h1>
            <p className="text-xs text-slate-500">{me.orgname ?? me.email ?? me.orgid}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setTab('content')}
              className={
                tab === 'content'
                  ? 'rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900'
              }
            >
              Nội dung
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={
                tab === 'settings'
                  ? 'rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900'
              }
            >
              Thiết lập
            </button>
          </nav>
          <button
            type="button"
            onClick={() => void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => {
              window.location.reload();
            })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Thoát
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {tab === 'content' ? <MainPage /> : <SettingsTab />}
      </main>
    </div>
  );
}
