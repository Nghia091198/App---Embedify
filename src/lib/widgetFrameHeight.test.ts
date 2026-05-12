import { describe, expect, it } from 'vitest';
import { computeWidgetEmbedContentHeight, parseWidgetResizePayload } from './widgetFrameHeight.js';

describe('computeWidgetEmbedContentHeight', () => {
  it('lấy max các chiều cao và ceil', () => {
    expect(
      computeWidgetEmbedContentHeight({
        rootScrollHeight: 100,
        documentElementScrollHeight: 250.2,
        bodyScrollHeight: 200,
      }),
    ).toBe(251);
  });

  it('áp dụng minHeight mặc định 80', () => {
    expect(
      computeWidgetEmbedContentHeight({
        rootScrollHeight: 0,
        documentElementScrollHeight: 0,
        bodyScrollHeight: 0,
      }),
    ).toBe(80);
  });

  it('cho phép minHeight tùy chỉnh', () => {
    expect(
      computeWidgetEmbedContentHeight({
        rootScrollHeight: 10,
        documentElementScrollHeight: 10,
        bodyScrollHeight: 10,
        minHeight: 120,
      }),
    ).toBe(120);
  });
});

describe('parseWidgetResizePayload', () => {
  it('chấp nhận wg-widget-frame-resize', () => {
    expect(parseWidgetResizePayload({ type: 'wg-widget-frame-resize', height: 440 })).toBe(440);
  });

  it('chấp nhận wg-resize (legacy)', () => {
    expect(parseWidgetResizePayload({ type: 'wg-resize', height: 300.9 })).toBe(300);
  });

  it('từ chối height < 80', () => {
    expect(parseWidgetResizePayload({ type: 'wg-widget-frame-resize', height: 40 })).toBe(80);
  });

  it('từ chối payload lạ', () => {
    expect(parseWidgetResizePayload(null)).toBeNull();
    expect(parseWidgetResizePayload({ type: 'other', height: 100 })).toBeNull();
    expect(parseWidgetResizePayload({ type: 'wg-resize', height: 'x' })).toBeNull();
  });
});
