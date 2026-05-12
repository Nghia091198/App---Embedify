import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Loader2, MoveLeft } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import type { WidgetConfigParsed } from '@/types/widget';
import { Toast } from '@/components/Toast';
import { ThemeColorStudio } from '@/components/settings/ThemeColorStudio';

type SubTab = 'general' | 'html-css';

type GeneralAccordionId = 'color' | 'display' | 'commerce';

const CONFIG_SNAPSHOT_KEYS: (keyof WidgetConfigParsed)[] = [
  'show_hidden_products',
  'max_blocks_per_content',
  'max_products_per_block',
  'enable_add_to_cart',
  'enable_quick_view',
  'primary_color',
  'show_price',
  'enable_contact',
  'contact_label',
  'contact_url',
  'custom_css',
  'font_import_url',
  'font_family',
];

const COLOR_KEYS = new Set<keyof WidgetConfigParsed>(['primary_color']);

function fieldEqual(a: unknown, b: unknown, key: keyof WidgetConfigParsed): boolean {
  if (COLOR_KEYS.has(key)) {
    return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  }
  return a === b;
}

function configsEqual(a: WidgetConfigParsed, b: WidgetConfigParsed): boolean {
  for (const k of CONFIG_SNAPSHOT_KEYS) {
    if (!fieldEqual(a[k], b[k], k)) return false;
  }
  return true;
}

interface SettingsTabProps {
  onBackToContent: () => void;
}

export function SettingsTab({ onBackToContent }: SettingsTabProps) {
  const { config, loading, reload } = useConfig();
  const [draft, setDraft] = useState<WidgetConfigParsed | null>(null);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('general');
  const [generalAccordion, setGeneralAccordion] = useState<GeneralAccordionId | null>('color');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');

  const dismissToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  const isDirty = useMemo(() => {
    if (!config || !draft) return false;
    return !configsEqual(config, draft);
  }, [config, draft]);

  function patch<K extends keyof WidgetConfigParsed>(key: K, value: WidgetConfigParsed[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  const saveDisabled = saving || !isDirty;

  async function save() {
    if (!draft || !isDirty || saving) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error('save');
      await reload({ silent: true });
      setToastVariant('success');
      setToastMessage('Lưu thành công');
    } catch {
      setToastVariant('error');
      setToastMessage('Không lưu được. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  }

  const footerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onBackToContent}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <MoveLeft className="size-4" aria-hidden />
        Quay lại
      </button>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saveDisabled}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1d9e75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Đang lưu…
          </>
        ) : (
          'Lưu thiết lập'
        )}
      </button>
    </div>
  );

  if (loading || !draft) {
    return <div className="p-6 text-sm text-slate-500">Đang tải…</div>;
  }

  const htmlStructure = `<div class="wg-block wg-block--grid">
  <div class="wg-block-title">Tiêu đề block</div>
  <div class="wg-grid wg-cols-4 wg-cols-m-2">
    <div class="wg-product-card">
      <div class="wg-product-image-outer wg-product-image-outer--qv">
        <a class="wg-product-link"><div class="wg-product-image-wrap">...</div></a>
        <div class="wg-product-qv-overlay"><button class="wg-action-view wg-action-view--overlay">...</button></div>
      </div>
      <div class="wg-product-thumbs">...</div>
      <div class="wg-product-info">
        <div class="wg-product-sku">...</div>
        <div class="wg-product-name">...</div>
        <div class="wg-product-price-row">...</div>
        <div class="wg-product-actions">...</div>
      </div>
    </div>
  </div>
</div>`;

  return (
    <div className="flex h-full flex-col">
      <Toast message={toastMessage} onDismiss={dismissToast} variant={toastVariant} />

      <div className="flex border-b border-slate-200 bg-white px-4">
        {(
          [
            { key: 'general', label: 'Thiết lập chung' },
            { key: 'html-css', label: 'HTML / CSS' },
          ] as { key: SubTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`border-b-2 -mb-px px-4 py-3 text-sm font-semibold transition-colors ${
              subTab === t.key
                ? 'border-[#1d9e75] text-[#1d9e75]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {subTab === 'general' && (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              <SettingsAccordionItem
                id="settings-acc-color"
                title="Màu chủ đạo"
                description="Nút, viền brand, giá, quickview trên storefront"
                expanded={generalAccordion === 'color'}
                onToggle={() =>
                  setGeneralAccordion((p) => (p === 'color' ? null : 'color'))
                }
              >
                <ThemeColorStudio
                  embedded
                  value={draft.primary_color}
                  onChange={(v) => patch('primary_color', v)}
                />
              </SettingsAccordionItem>

              <SettingsAccordionItem
                id="settings-acc-display"
                title="Hiển thị"
                description="Giá và quickview"
                expanded={generalAccordion === 'display'}
                onToggle={() =>
                  setGeneralAccordion((p) => (p === 'display' ? null : 'display'))
                }
              >
                <div className="space-y-3">
                  <Checkbox
                    label="Hiển thị giá"
                    checked={draft.show_price}
                    onChange={(v) => patch('show_price', v)}
                  />
                  <Checkbox
                    label="Hiển thị Xem nhanh (Quickview)"
                    checked={draft.enable_quick_view}
                    onChange={(v) => patch('enable_quick_view', v)}
                  />
                </div>
              </SettingsAccordionItem>

              <SettingsAccordionItem
                id="settings-acc-commerce"
                title="Tính năng mua hàng"
                description="Nút mua / liên hệ"
                expanded={generalAccordion === 'commerce'}
                onToggle={() =>
                  setGeneralAccordion((p) => (p === 'commerce' ? null : 'commerce'))
                }
              >
                <div className="space-y-3">
                  <Checkbox
                    label="Hiển thị nút Mua hàng"
                    checked={draft.enable_add_to_cart}
                    onChange={(v) => patch('enable_add_to_cart', v)}
                  />
                  {!draft.enable_add_to_cart && (
                    <div className="ml-6 space-y-3 border-l-2 border-slate-200 pl-4">
                      <Checkbox
                        label="Hiển thị nút Liên hệ thay thế"
                        checked={draft.enable_contact}
                        onChange={(v) => patch('enable_contact', v)}
                      />
                      {draft.enable_contact && (
                        <div className="space-y-2">
                          <label className="block text-sm text-slate-700">
                            Tiêu đề nút
                            <input
                              type="text"
                              value={draft.contact_label}
                              onChange={(e) => patch('contact_label', e.target.value)}
                              placeholder="Liên hệ"
                              className="focus:border-[#1d9e75] focus:outline-none mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                            />
                          </label>
                          <label className="block text-sm text-slate-700">
                            Đường dẫn
                            <input
                              type="text"
                              value={draft.contact_url}
                              onChange={(e) => patch('contact_url', e.target.value)}
                              placeholder="https://... hoặc /pages/lien-he"
                              className="focus:border-[#1d9e75] focus:outline-none mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SettingsAccordionItem>
            </div>

            {footerActions}
          </div>
        )}

        {subTab === 'html-css' && (
          <div className="mx-auto space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
              <section className="flex flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-bold text-slate-900">Font chữ</h2>
                <label className="block text-sm text-slate-700">
                  URL Import font (Google Fonts / CDN)
                  <input
                    type="text"
                    value={draft.font_import_url}
                    onChange={(e) => patch('font_import_url', e.target.value)}
                    placeholder="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro&display=swap"
                    className="focus:border-[#1d9e75] focus:outline-none outline-none mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                  <span className="mt-1 block text-xs text-slate-400">
                    Inject &lt;link rel=&quot;stylesheet&quot; …&gt; vào widget
                  </span>
                </label>
                <label className="block text-sm text-slate-700">
                  Font-family
                  <input
                    type="text"
                    value={draft.font_family}
                    onChange={(e) => patch('font_family', e.target.value)}
                    placeholder="'Be Vietnam Pro', sans-serif"
                    className="focus:border-[#1d9e75] focus:outline-none outline-none mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </label>
              </section>

              <section className="flex min-h-0 flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-bold text-slate-900">CSS tùy chỉnh</h2>
                <p className="text-xs text-slate-500">
                  Ưu tiên cao nhất, ghi đè style mặc định.
                </p>
                <textarea
                  value={draft.custom_css}
                  onChange={(e) => patch('custom_css', e.target.value)}
                  rows={14}
                  spellCheck={false}
                  placeholder={`.wg-product-card {\n  border-radius: 12px;\n}\n\n.wg-btn-addcart {\n  background: #333;\n}`}
                  className="min-h-[280px] w-full flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed focus:border-[#1d9e75] focus:outline-none"
                />
              </section>

              <section className="flex min-h-0 flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-bold text-slate-900">HTML Structure</h2>
                <p className="text-xs text-slate-500">Tham chiếu selector khi viết CSS.</p>
                <pre className="max-h-[min(420px,50vh)] min-h-[200px] flex-1 select-all overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100 lg:text-xs">
                  {htmlStructure}
                </pre>
              </section>
            </div>

            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsAccordionItem({
  id,
  title,
  description,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const triggerId = `${id}-trigger`;
  return (
    <div className="bg-white">
      <button
        type="button"
        id={triggerId}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/90"
      >
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        </div>
        <ChevronDown
          className={`size-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          id={id}
          role="region"
          aria-labelledby={triggerId}
          className="border-t border-slate-100 bg-slate-50/50 px-4 py-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-slate-300 accent-[#1d9e75]"
      />
      {label}
    </label>
  );
}
