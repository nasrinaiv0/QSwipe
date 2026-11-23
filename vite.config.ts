/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';

const CSP = (scriptHash: string) => [
  "default-src 'none'",
  `script-src 'self' '${scriptHash}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Compiles src/boot.ts (applies the saved theme before first paint), inlines it in <head>,
 * and — in production builds — adds a CSP whose script-src allows exactly that inline script by hash.
 */
function bootScript(): Plugin {
  let code = '';
  return {
    name: 'qswipe-boot-script',
    async buildStart() {
      const file = fileURLToPath(new URL('./src/boot.ts', import.meta.url));
      const out = await transformWithOxc(readFileSync(file, 'utf8'), file, { lang: 'ts' });
      code = out.code.trim();
    },
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? '' : `<meta http-equiv="Content-Security-Policy" content="${CSP(`sha256-${createHash('sha256').update(code).digest('base64')}`)}">\n  `;
      return html.replace('<!--qswipe:head-->', `${csp}<script>${code}</script>`);
    },
  };
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [bootScript()],
  server: { port: 4173 },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false },
    sourcemap: true,
    chunkSizeWarningLimit: 300,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
