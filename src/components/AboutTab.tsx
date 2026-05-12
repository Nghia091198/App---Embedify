import { APP_INFO } from '@/lib/appVersion';

const FEATURES: Array<[string, string]> = [
  ['widgets', 'Tạo tối đa 5 block sản phẩm trong một nội dung, mỗi block tối đa 15 sản phẩm'],
  ['grid_view', 'Hiển thị dạng Grid (3–5 cột) hoặc Slider tự động — responsive desktop & mobile'],
  ['search', 'Chọn vị trí chèn linh hoạt: đầu bài, sau đoạn văn bất kỳ, hoặc cuối bài'],
  [
    'shopping_cart',
    'Nút Mua hàng tích hợp giỏ hàng Haravan, Xem nhanh (Quickview) với gallery ảnh và chọn phân loại',
  ],
  ['palette', 'Tùy chỉnh màu chủ đạo, font chữ và CSS riêng để đồng bộ giao diện website'],
  ['sync', 'Thay đổi cấu hình có hiệu lực ngay lập tức trên toàn bộ trang — không cần lưu lại từng bài'],
];

export function AboutTab() {
  return (
    <div className="mx-auto p-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-10 lg:gap-8">
        {/* Cột trái ~3/10: header + phiên bản */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#1d9e75] shadow-md">
              <span className="material-symbols-outlined text-[32px] text-white">widgets</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900">Widget Block Sản Phẩm</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  v{APP_INFO.version}
                </span>
                <span className="text-xs text-slate-400">{APP_INFO.buildDate}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400">
            <div className="flex justify-between gap-2">
              <span>Phiên bản</span>
              <span className="font-mono font-semibold text-slate-600">{APP_INFO.version}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Cập nhật</span>
              <span className="font-mono text-slate-500">{APP_INFO.buildDate}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Nền tảng</span>
              <span className="font-mono text-slate-500">Haravan</span>
            </div>
          </div>
        </div>

        {/* Cột phải ~7/10: giới thiệu + hỗ trợ */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">Giới thiệu</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              <strong>Widget Block Sản Phẩm</strong> giúp bạn chèn nhóm sản phẩm trực tiếp vào nội dung bài viết,
              trang nội dung và trang sản phẩm trên Haravan — không cần chỉnh theme hay viết code.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {FEATURES.map(([icon, text]) => (
                <li key={icon} className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-[#1d9e75]">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">Hỗ trợ</h2>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">mail</span>
                <a href={`mailto:${APP_INFO.supportEmail}`} className="font-medium text-[#1d9e75] hover:underline">
                  {APP_INFO.supportEmail}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">help</span>
                <a
                  href={APP_INFO.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#1d9e75] hover:underline"
                >
                  Liên hệ hỗ trợ trực tiếp
                </a>
              </div>
            </div>
            <p className="pt-1 text-xs text-slate-400">Thời gian phản hồi: trong vòng 24 giờ làm việc.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
