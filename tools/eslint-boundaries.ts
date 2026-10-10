import { isBuiltin } from 'node:module';
import path from 'node:path';
import type { Rule } from 'eslint';

function featureOf(file: string) {
  const match = /^(src|server)\/features\/([^/]+)(?:\/(.*))?$/.exec(file);
  if (!match) return undefined;
  return { owner: `${match[1]}/features/${match[2]}`, file: match[3] ?? '' };
}

function isPublicEntry(file: string) {
  return file === '' || /^index(?:\.[cm]?[jt]sx?)?$/.test(file);
}

// Resolve the repository's relative imports and sole alias; no module graph needed.
export const boundaries: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      runtime: 'Keep {{from}} imports within {{allowed}}.',
      shared: 'Shared contracts must not depend on packages or runtime code.',
      builtin: 'Node.js modules must stay on the server.',
      feature: 'Import {{owner}} through its public index.ts interface.',
      composition: 'Features must not import application composition code.',
      utility: 'Shared components and utilities must not depend on features.',
      http: 'Keep Hono and routes.ts dependencies in routes.ts or index.ts; business logic must be independent of HTTP.',
      computed:
        'Use literal module paths so architecture boundaries can be checked.',
      absolute: 'Use relative module paths or the @/ browser alias.',
    },
  },
  create(context) {
    const root = context.cwd;
    const from = path
      .relative(root, context.filename)
      .split(path.sep)
      .join('/');
    const area = from.split('/')[0];
    const feature = featureOf(from);
    const allowed: Record<string, string[]> = {
      src: ['src', 'shared'],
      server: ['server', 'shared'],
      api: ['api', 'server', 'shared'],
      shared: ['shared'],
    };
    const allowedAreas = allowed[area ?? ''];
    if (!allowedAreas) return {};

    const business =
      area === 'server' &&
      feature &&
      !/^(?:index|routes)\.ts$/.test(feature.file);

    const check = (node: Rule.Node) => {
      if (!('value' in node) || typeof node.value !== 'string') return;
      const source = node.value;
      if (path.isAbsolute(source)) {
        context.report({ node, messageId: 'absolute' });
        return;
      }
      const local = source.startsWith('.') || source.startsWith('@/');
      const target = local
        ? path
            .relative(
              root,
              source.startsWith('@/')
                ? path.resolve(root, 'src', source.slice(2))
                : path.resolve(path.dirname(context.filename), source),
            )
            .split(path.sep)
            .join('/')
            .replace(/[?#].*$/, '')
        : undefined;

      if (business && (source === 'hono' || source.startsWith('hono/'))) {
        context.report({ node, messageId: 'http' });
      } else if ((area === 'src' || area === 'shared') && isBuiltin(source)) {
        context.report({ node, messageId: 'builtin' });
      } else if (area === 'shared' && !target) {
        context.report({ node, messageId: 'shared' });
      } else if (target) {
        if (!allowedAreas.includes(target.split('/')[0] ?? '')) {
          context.report({
            node,
            messageId: 'runtime',
            data: { from: area ?? '', allowed: allowedAreas.join(' or ') },
          });
          return;
        }

        if (
          feature &&
          (target.startsWith('src/app/') ||
            target.startsWith('src/routes/') ||
            /^server\/app(?:\.ts)?$/.test(target))
        ) {
          context.report({ node, messageId: 'composition' });
          return;
        }

        const imported = featureOf(target);
        if (
          imported &&
          /^(?:src\/(?:components|lib)|server\/lib)\//.test(from)
        ) {
          context.report({ node, messageId: 'utility' });
        } else if (
          imported &&
          imported.owner !== feature?.owner &&
          !isPublicEntry(imported.file)
        ) {
          context.report({
            node,
            messageId: 'feature',
            data: { owner: imported.owner },
          });
        } else if (
          business &&
          imported &&
          /^routes(?:\.ts)?$/.test(imported.file)
        ) {
          context.report({ node, messageId: 'http' });
        }
      }
    };

    return {
      'ImportDeclaration > Literal.source': check,
      'ExportNamedDeclaration > Literal.source': check,
      'ExportAllDeclaration > Literal.source': check,
      'ImportExpression > Literal.source': check,
      'TSImportType > Literal.source': check,
      'TSExternalModuleReference > Literal.expression': check,
      "CallExpression[callee.name='require'] > Literal.arguments": check,
      'ImportExpression > :not(Literal).source'(node: Rule.Node) {
        context.report({ node, messageId: 'computed' });
      },
      "CallExpression[callee.name='require'] > :not(Literal).arguments"(
        node: Rule.Node,
      ) {
        context.report({ node, messageId: 'computed' });
      },
    };
  },
};
