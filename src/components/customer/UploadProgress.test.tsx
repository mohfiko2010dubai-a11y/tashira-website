import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UploadProgress } from './UploadProgress';

describe('upload feedback', () => {
  it('renders Arabic verifying feedback and holds at 96', () => {
    const html = renderToStaticMarkup(<UploadProgress name="synthetic.jpg" ar progress={{ phase: 'saving' }} />);
    expect(html).toContain('جارٍ التحقّق من الملف');
    expect(html).toContain('aria-valuenow="96"');
    expect(html).not.toContain('aria-valuenow="100"');
  });
  it('keeps filename, error and retry together', () => {
    const html = renderToStaticMarkup(<UploadProgress name="synthetic.jpg" ar={false} progress={{ phase: 'failed' }} error="Check your connection and retry." retry={() => {}} />);
    expect(html).toContain('synthetic.jpg');
    expect(html).toContain('Retry');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-valuenow="0"');
  });
});
