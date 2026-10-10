import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({
  cwd: fileURLToPath(new URL('..', import.meta.url)),
});

async function boundaryMessages(filePath: string, code: string) {
  // Lint virtual files against the real config, without adding example features.
  const [result] = await eslint.lintText(code, { filePath });
  expect(result).toBeDefined();
  expect(result?.messages.filter((message) => message.fatal)).toEqual([]);
  return result?.messages.filter(
    (message) => message.ruleId === 'architecture/boundaries',
  );
}

describe('architecture boundaries', () => {
  it.each([
    ['src/lib/api.ts', "import type { T } from '../../shared/api';"],
    [
      'src/routes/index.tsx',
      "export { View } from '../features/orders/index';",
    ],
    ['src/routes/index.tsx', "export { View } from '@/features/orders';"],
    ['src/features/orders/view.tsx', "import { x } from './internal';"],
    [
      'src/features/orders/view.tsx',
      "import { x } from '@/components/button';",
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '../billing/index.ts';",
    ],
    ['src/features/orders/index.ts', "export { View } from './view';"],
    ['server/app.ts', "import { routes } from './features/orders/index.ts';"],
    ['server/features/orders/use-cases.ts', "import { x } from './internal';"],
    ['server/features/orders/use-cases.ts', "import { x } from '../billing';"],
    ['server/features/orders/routes.ts', "import { Hono } from 'hono';"],
    [
      'server/features/orders/index.ts',
      "export { routes } from './routes.ts';",
    ],
    ['server/app.ts', "import { readFile } from 'node:fs/promises';"],
    ['api/index.ts', "import { app } from '../server/app.ts';"],
    ['shared/orders.ts', "import type { T } from './api';"],
    [
      'src/routes/index.tsx',
      "const page = import('../features/orders/index');",
    ],
    [
      'tests/orders.test.ts',
      "import { x } from '../server/features/orders/internal';",
    ],
    ['vite.config.ts', "import handler from './api/index.ts';"],
  ])('allows %s: %s', async (file, code) => {
    expect(await boundaryMessages(file, code)).toEqual([]);
  });

  it.each([
    ['src/lib/api.ts', "import { app } from '../../server/app';", 'runtime'],
    ['src/lib/api.ts', "import type { T } from '../../server/app';", 'runtime'],
    ['src/lib/api.ts', "export * from '../../api/index';", 'runtime'],
    ['src/lib/api.ts', "const api = import('../../server/app');", 'runtime'],
    ['src/lib/api.ts', "type T = import('../../server/app').T;", 'runtime'],
    ['src/lib/api.ts', "const api = require('../../server/app');", 'runtime'],
    ['src/lib/api.ts', "import api = require('../../server/app');", 'runtime'],
    ['src/lib/api.ts', "import { x } from '../../tools/internal';", 'runtime'],
    ['src/lib/api.ts', "import { x } from 'node:fs';", 'builtin'],
    ['src/lib/api.ts', "import { x } from 'fs/promises';", 'builtin'],
    ['src/lib/api.ts', 'const page = import(modulePath);', 'computed'],
    ['src/lib/api.ts', 'const page = import(`../../server/app`);', 'computed'],
    ['src/lib/api.ts', 'const page = require(modulePath);', 'computed'],
    ['src/lib/api.ts', "import { app } from '/server/app';", 'absolute'],
    ['server/app.ts', "import { x } from '../src/lib/api';", 'runtime'],
    ['server/app.ts', "import { x } from '@/lib/api';", 'runtime'],
    ['server/app.ts', "import handler from '../api/index';", 'runtime'],
    ['api/index.ts', "import { x } from '../src/lib/api';", 'runtime'],
    ['shared/api.ts', "export type { T } from '../server/app';", 'runtime'],
    ['shared/api.ts', "import type { T } from '../src/lib/api';", 'runtime'],
    ['shared/api.ts', "import type { Context } from 'hono';", 'shared'],
    ['shared/api.ts', "import type { Stats } from 'node:fs';", 'builtin'],
    [
      'src/routes/index.tsx',
      "import { x } from '../features/orders/internal';",
      'feature',
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '@/features/billing/internal';",
      'feature',
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '../billing/index/hidden';",
      'feature',
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '@/features/orders/../billing/internal';",
      'feature',
    ],
    [
      'server/app.ts',
      "import { x } from './features/orders/routes.ts';",
      'feature',
    ],
    [
      'server/features/orders/use-cases.ts',
      "export { x } from '../billing/internal';",
      'feature',
    ],
    [
      'src/components/button.tsx',
      "export * from '@/features/orders/index';",
      'utility',
    ],
    ['src/lib/api.ts', "import { x } from '@/features/orders';", 'utility'],
    [
      'server/lib/format.ts',
      "import { x } from '../features/orders/index';",
      'utility',
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '../../app/router';",
      'composition',
    ],
    [
      'src/features/orders/view.tsx',
      "import { x } from '@/routes/root';",
      'composition',
    ],
    [
      'server/features/orders/use-cases.ts',
      "import { app } from '../../app.ts';",
      'composition',
    ],
    [
      'server/features/orders/use-cases.ts',
      "import type { Context } from 'hono';",
      'http',
    ],
    [
      'server/features/orders/use-cases.ts',
      "import { HTTPException } from 'hono/http-exception';",
      'http',
    ],
    [
      'server/features/orders/use-cases.ts',
      "import { routes } from './routes.ts';",
      'http',
    ],
  ])('rejects %s: %s', async (file, code, messageId) => {
    expect(await boundaryMessages(file, code)).toEqual([
      expect.objectContaining({ messageId, severity: 2 }),
    ]);
  });
});
