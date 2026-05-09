import { useEffect, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import type { WidgetConfigParsed } from '@/types/widget';

export function SettingsTab() {
  const { config, loading, reload } = useConfig();
  const [draft, setDraft] = useState<WidgetConfigParsed | null>(null);
  const [saving, setSaving] = useState(false);
  const [snippetMsg, setSnippetMsg] = useState<string | null>(null);

  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error('save');
      await reload();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function installSnippet() {
    setSnippetMsg(null);
    try {
      const r = await fetch('/api/admin/snippet/install', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = (await r.json()) as { ok?: boolean; src?: string };
      setSnippetMsg(j.ok ? `Đã đăng ký: ${j.src ?? ''}` : 'Đăng ký thất bại (kiểm tra scope script tag).');
    } catch {
      setSnippetMsg('Lỗi mạng.');
    }
  }

  if (loading || !draft) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Đang tải cấu hình…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 p-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-bold text-slate-900">Hiển thị sản phẩm</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.show_hidden_products}
            onChange={(e) => setDraft({ ...draft, show_hidden_products: e.target.checked })}
            className="size-4 rounded border-slate-300"
          />
          Hiển thị sản phẩm đang ẩn trong danh sách chọn
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-bold text-slate-900">Giới hạn</h2>
        <label className="block text-sm text-slate-700">
          Số block tối đa mỗi nội dung
          <input
            type="number"
            min={1}
            value={draft.max_blocks_per_content}
            onChange={(e) =>
              setDraft({ ...draft, max_blocks_per_content: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Số sản phẩm tối đa mỗi block
          <input
            type="number"
            min={1}
            value={draft.max_products_per_block}
            onChange={(e) =>
              setDraft({ ...draft, max_products_per_block: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-bold text-slate-900">Storefront</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.enable_add_to_cart}
            onChange={(e) => setDraft({ ...draft, enable_add_to_cart: e.target.checked })}
            className="size-4 rounded border-slate-300"
          />
          Hiển thị nút Mua hàng
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.enable_quick_view}
            onChange={(e) => setDraft({ ...draft, enable_quick_view: e.target.checked })}
            className="size-4 rounded border-slate-300"
          />
          Hiển thị nút Xem nhanh
        </label>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-slate-900">ScriptTag</h2>
        <p className="text-xs text-slate-600">
          Đăng ký <code className="rounded bg-slate-100 px-1">widget-snippet.js</code> lên gian hàng (HTTPS). Cần scope
          script tag trên Haravan Partners.
        </p>
        <button
          type="button"
          onClick={() => void installSnippet()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Cài snippet lên shop
        </button>
        {snippetMsg ? <p className="text-xs text-slate-600">{snippetMsg}</p> : null}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-[#1d9e75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu…' : 'Lưu thiết lập'}
        </button>
      </div>
    </div>
  );
}
