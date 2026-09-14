import { describe, expect, it } from 'vitest';
import { uploadDisplayPercent } from './upload-progress';

describe('honest upload completion', () => {
  it('reserves 100 for server acceptance, including after all bytes are sent', () => {
    expect(uploadDisplayPercent({ phase: 'uploading', percent: 50 })).toBe(48);
    expect(uploadDisplayPercent({ phase: 'uploading', percent: 100 })).toBe(96);
    expect(uploadDisplayPercent({ phase: 'processing' })).toBe(96);
    expect(uploadDisplayPercent({ phase: 'saving' })).toBe(96);
    expect(uploadDisplayPercent({ phase: 'accepted' })).toBe(100);
  });
  it('does not invent progress for an unknown total', () => {
    expect(uploadDisplayPercent({ phase: 'uploading' })).toBeUndefined();
    expect(uploadDisplayPercent({ phase: 'uploading', percent: NaN })).toBeUndefined();
  });
  it('drains on failure and clamps out-of-range transport values', () => {
    expect(uploadDisplayPercent({ phase: 'failed', percent: 96 })).toBe(0);
    expect(uploadDisplayPercent({ phase: 'uploading', percent: 300 })).toBe(96);
    expect(uploadDisplayPercent({ phase: 'uploading', percent: -10 })).toBe(0);
  });
});
