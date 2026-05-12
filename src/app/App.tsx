import { useEffect, useMemo, useState } from 'react';
import { AboutTab } from '@/components/AboutTab';
import { SettingsTab } from '@/components/settings/SettingsTab';
import { APP_INFO } from '@/lib/appVersion';
import { MainPage } from '@/pages/MainPage';

type Tab = 'content' | 'settings' | 'about';

type Me = {
  orgid?: string | null;
  orgname?: string | null;
  name?: string | null;
  email?: string | null;
  shop_domain?: string | null;
};

export function App() {
  const [tab, setTab] = useState<Tab>('content');
  const [me, setMe] = useState<Me | null | false>(false);

  const oauthError = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('auth_error');
    return q ? decodeURIComponent(q) : null;
  }, []);

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

  useEffect(() => {
    if (me === false) return;
    if (me?.orgid) return;
    if (oauthError) return;
    const qs = new URLSearchParams(window.location.search);
    qs.delete('auth_error');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    window.location.replace(`/api/auth/install${suffix}`);
  }, [me, oauthError]);

  if (me === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Đang tải…</p>
      </div>
    );
  }

  if (!me?.orgid) {
    if (oauthError) {
      const qs = new URLSearchParams(window.location.search);
      qs.delete('auth_error');
      const installHref = `/api/auth/install${qs.toString() ? `?${qs.toString()}` : ''}`;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
          <p className="text-center text-sm text-rose-600">Đăng nhập thất bại: {oauthError}</p>
          <a
            href={installHref}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1d9e75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Thử cấp quyền lại
          </a>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-center text-sm text-slate-500">Đang chuyển đến Haravan để cấp quyền…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#1d9e75]">widgets</span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Widget Block sản phẩm</h1>
            <p className="text-xs text-slate-500">{me.orgname ?? me.email ?? me.orgid}</p>
          </div>
        </div>
        <div className="relative justify-self-center">
          <div className="relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-5 py-1.5 ring-1 ring-emerald-100 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#1d9e75]" />
            <h2 className="text-sm font-bold tracking-wide text-slate-900">
              {tab === 'content' ? 'Nội dung' : tab === 'settings' ? 'Thiết lập' : 'Về chúng tôi'}
            </h2>
            <span className="size-1.5 rounded-full bg-[#1d9e75]" />
          </div>
          <span
            aria-hidden
            className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 size-3 rotate-45 bg-gradient-to-br from-white to-emerald-50 ring-1 ring-emerald-100 [clip-path:polygon(0_100%,100%_0,100%_100%)]"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
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

          <div className="h-5 w-px bg-slate-200" aria-hidden />

          <button
            type="button"
            onClick={() => setTab('about')}
            className={
              tab === 'about'
                ? 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 transition-colors'
                : 'rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700'
            }
          >
            Về chúng tôi
          </button>

          <a
            href={APP_INFO.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d9e75] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <span className="material-symbols-outlined text-[14px]">support_agent</span>
            Liên hệ hỗ trợ
          </a>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {tab === 'content' ? (
          <MainPage shopDomain={me.shop_domain ?? null} />
        ) : tab === 'settings' ? (
          <SettingsTab onBackToContent={() => setTab('content')} />
        ) : (
          <AboutTab />
        )}
      </main>
    </div>
  );
}
