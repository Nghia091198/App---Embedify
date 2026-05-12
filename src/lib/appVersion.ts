/** Phiên bản app — cập nhật khi release (đồng bộ với package.json khi bump version). */
export const APP_VERSION = '0.1.0';
export const APP_BUILD_DATE = '2026-05';

export const APP_INFO = {
  version: APP_VERSION,
  buildDate: APP_BUILD_DATE,
  /** Thay bằng email hỗ trợ thật của bạn */
  supportEmail: 'support@yourapp.com',
  /** Thay bằng URL trang liên hệ / docs */
  supportUrl: 'https://yourapp.com/lien-he',
} as const;
