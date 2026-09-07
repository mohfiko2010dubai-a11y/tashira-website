import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('content discovery navigation', () => {
  it('exposes guides, news, homepage highlights and admin content entry points', () => {
    const header = fs.readFileSync('src/components/shared/Header.tsx', 'utf8');
    const footer = fs.readFileSync('src/components/shared/Footer.tsx', 'utf8');
    const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
    const admin = fs.readFileSync('src/pages/admin/AdminApplications.tsx', 'utf8');
    expect(header).toContain("path: '/guides'");
    expect(header).toContain("path: '/news'");
    expect(footer).toContain("path: '/guides'");
    expect(footer).toContain("path: '/news'");
    expect(home).toContain('<ContentHighlights />');
    expect(admin).toContain('to="/admin/content"');
  });
});
