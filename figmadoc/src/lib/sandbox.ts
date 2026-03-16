import type { CodeRuntime } from '../types';

const REACT_VERSION = '19.2.4';
const REACT_IMPORT_URL = `https://esm.sh/react@${REACT_VERSION}?dev`;
const REACT_JSX_RUNTIME_IMPORT_URL = `https://esm.sh/react@${REACT_VERSION}/jsx-runtime?dev`;
const REACT_JSX_DEV_RUNTIME_IMPORT_URL = `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime?dev`;
const REACT_DOM_IMPORT_URL = `https://esm.sh/react-dom@${REACT_VERSION}?dev`;
const REACT_DOM_CLIENT_IMPORT_URL = `https://esm.sh/react-dom@${REACT_VERSION}/client?dev`;
const BABEL_STANDALONE_URL = 'https://unpkg.com/@babel/standalone@7/babel.min.js';
const TAILWIND_CDN_URL = 'https://cdn.tailwindcss.com';
const IMPORT_MAP = JSON.stringify({
  imports: {
    react: REACT_IMPORT_URL,
    'react/jsx-runtime': REACT_JSX_RUNTIME_IMPORT_URL,
    'react/jsx-dev-runtime': REACT_JSX_DEV_RUNTIME_IMPORT_URL,
    'react-dom': REACT_DOM_IMPORT_URL,
    'react-dom/client': REACT_DOM_CLIENT_IMPORT_URL,
  },
});

export interface SandboxResult {
  output: string[];
  error?: string;
  timedOut?: boolean;
}

interface PreparedReactCode {
  code: string;
  hasManualRender: boolean;
  moduleSources: string[];
  runtimeError?: string;
}

export function buildSandboxHTML(
  html: string,
  css: string,
  js: string,
  runtime: CodeRuntime = 'browser'
): string {
  return runtime === 'react'
    ? buildReactSandboxHTML(html, css, js)
    : buildBrowserSandboxHTML(html, css, js);
}

export function createSandboxIframe(
  container: HTMLElement,
  html: string,
  css: string,
  js: string,
  onMessage: (msg: { type: string; level?: string; msg?: string }) => void,
  timeoutMs = 5000,
  runtime: CodeRuntime = 'browser'
): () => void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('title', 'Code Sandbox');

  let timer: ReturnType<typeof setTimeout>;

  const handler = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data?.type) return;

    if (data.type === 'ready' || data.type === 'error') {
      clearTimeout(timer);
    }

    if (data.type === 'ready') {
      onMessage({ type: 'ready' });
      return;
    }

    onMessage(data);
  };

  window.addEventListener('message', handler);

  iframe.srcdoc = buildSandboxHTML(html, css, js, runtime);

  timer = setTimeout(() => {
    onMessage({ type: 'error', msg: `Execution timed out after ${Math.round(timeoutMs / 1000)} seconds` });
  }, timeoutMs);

  container.innerHTML = '';
  container.appendChild(iframe);

  return () => {
    window.removeEventListener('message', handler);
    clearTimeout(timer);
  };
}

function buildBrowserSandboxHTML(html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    (function() {
      const _orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };

      function serialize(val) {
        if (val === null) return 'null';
        if (val === undefined) return 'undefined';
        if (typeof val === 'object') {
          try { return JSON.stringify(val, null, 2); } catch { return String(val); }
        }
        return String(val);
      }

      function intercept(level) {
        return function(...args) {
          const msg = args.map(serialize).join(' ');
          parent.postMessage({ type: level, level, msg }, '*');
          _orig[level].apply(console, args);
        };
      }

      console.log = intercept('log');
      console.error = intercept('error');
      console.warn = intercept('warn');
      console.info = intercept('info');

      window.onerror = function(msg, src, line) {
        parent.postMessage({ type: 'error', msg: msg + (line ? ' (line ' + line + ')' : '') }, '*');
        return true;
      };

      window.addEventListener('unhandledrejection', function(event) {
        parent.postMessage({ type: 'error', msg: 'Unhandled Promise: ' + (event.reason?.message || event.reason) }, '*');
      });

      try {
        ${js}
      } catch (error) {
        parent.postMessage({ type: 'error', msg: error.message || String(error) }, '*');
      }

      parent.postMessage({ type: 'ready' }, '*');
    })();
  </script>
</body>
</html>`;
}

function buildReactSandboxHTML(html: string, css: string, js: string): string {
  const prepared = prepareReactCode(js);
  const hasRootMount = /\bid\s*=\s*['"]root['"]/.test(html);
  const serializedHtml = html;
  const serializedCode = serializeForInlineScript(prepared.code);
  const serializedError = serializeForInlineScript(prepared.runtimeError ?? '');
  const serializedModuleMap = serializeForInlineScript(JSON.stringify(buildModuleUrlMap(prepared.moduleSources)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .animate-in { animation-duration: .5s; animation-fill-mode: both; }
    .fade-in { animation-name: sandbox-fade-in; }
    .slide-in-from-bottom-4 { animation-name: sandbox-slide-bottom; }
    .slide-in-from-right-8 { animation-name: sandbox-slide-right; }
    @keyframes sandbox-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sandbox-slide-bottom { from { opacity: 0; transform: translateY(1rem); } to { opacity: 1; transform: translateY(0); } }
    @keyframes sandbox-slide-right { from { opacity: 0; transform: translateX(2rem); } to { opacity: 1; transform: translateX(0); } }
    ${css}
  </style>
  <script>window.process = { env: { NODE_ENV: 'development' } }; window.global = window;</script>
  <script src="${TAILWIND_CDN_URL}"></script>
  <script src="${BABEL_STANDALONE_URL}"></script>
  <script type="importmap">${IMPORT_MAP}</script>
</head>
<body>
  ${serializedHtml}
  ${hasRootMount ? '' : '<div id="root"></div>'}
  <script type="module">
    (async function() {
      const _orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };

      function post(type, payload) {
        parent.postMessage({ type, ...payload }, '*');
      }

      function serialize(val) {
        if (val === null) return 'null';
        if (val === undefined) return 'undefined';
        if (typeof val === 'object') {
          try { return JSON.stringify(val, null, 2); } catch { return String(val); }
        }
        return String(val);
      }

      function intercept(level) {
        return function(...args) {
          const msg = args.map(serialize).join(' ');
          post(level, { level, msg });
          _orig[level].apply(console, args);
        };
      }

      console.log = intercept('log');
      console.error = intercept('error');
      console.warn = intercept('warn');
      console.info = intercept('info');

      window.onerror = function(msg, src, line) {
        post('error', { msg: msg + (line ? ' (line ' + line + ')' : '') });
        return true;
      };

      window.addEventListener('unhandledrejection', function(event) {
        post('error', { msg: 'Unhandled Promise: ' + (event.reason?.message || event.reason) });
      });

      try {
        const runtimeError = ${serializedError};
        if (runtimeError) throw new Error(runtimeError);
        if (!window.Babel) throw new Error('Babel runtime failed to load in the preview iframe.');

        const moduleUrlMap = JSON.parse(${serializedModuleMap});
        const moduleEntries = await Promise.all(
          Object.entries(moduleUrlMap).map(async ([source, url]) => [source, await import(url)])
        );
        const __modules = Object.fromEntries(moduleEntries);

        const React = __modules['react']?.default ?? __modules['react'];
        const ReactDOMModule = __modules['react-dom'] ?? {};
        const ReactDOMClientModule = __modules['react-dom/client'] ?? {};
        const ReactDOMCompat = {
          ...ReactDOMModule,
          ...ReactDOMClientModule,
          render(element, container) {
            const root = ReactDOMClientModule.createRoot(container);
            root.render(element);
            return root;
          },
        };

        window.React = React;
        window.ReactDOM = ReactDOMCompat;
        window.ReactDOMClient = ReactDOMCompat;
        Object.assign(window, {
          Children: React.Children,
          Component: React.Component,
          Fragment: React.Fragment,
          Profiler: React.Profiler,
          PureComponent: React.PureComponent,
          StrictMode: React.StrictMode,
          Suspense: React.Suspense,
          cloneElement: React.cloneElement,
          createContext: React.createContext,
          createElement: React.createElement,
          createRef: React.createRef,
          forwardRef: React.forwardRef,
          lazy: React.lazy,
          memo: React.memo,
          startTransition: React.startTransition,
          use: React.use,
          useActionState: React.useActionState,
          useCallback: React.useCallback,
          useContext: React.useContext,
          useDebugValue: React.useDebugValue,
          useDeferredValue: React.useDeferredValue,
          useEffect: React.useEffect,
          useId: React.useId,
          useImperativeHandle: React.useImperativeHandle,
          useInsertionEffect: React.useInsertionEffect,
          useLayoutEffect: React.useLayoutEffect,
          useMemo: React.useMemo,
          useOptimistic: React.useOptimistic,
          useReducer: React.useReducer,
          useRef: React.useRef,
          useState: React.useState,
          useSyncExternalStore: React.useSyncExternalStore,
          useTransition: React.useTransition,
          createPortal: ReactDOMCompat.createPortal,
          createRoot: ReactDOMClientModule.createRoot?.bind(ReactDOMClientModule),
          flushSync: ReactDOMCompat.flushSync?.bind(ReactDOMCompat),
          hydrateRoot: ReactDOMClientModule.hydrateRoot?.bind(ReactDOMClientModule),
          render: ReactDOMCompat.render?.bind(ReactDOMCompat),
        });

        const source = ${serializedCode};
        const transformed = window.Babel.transform(source, {
          presets: [
            ['react', { runtime: 'classic' }],
            ['typescript', { isTSX: true, allExtensions: true }],
          ],
          sourceType: 'script',
          filename: 'sandbox.jsx',
        }).code;

        const executorSource = [
          '"use strict";',
          'let __defaultExport;',
          transformed,
          'return {',
          "  defaultExport: typeof __defaultExport !== 'undefined' ? __defaultExport : undefined,",
          "  appExport: typeof App !== 'undefined' ? App : undefined,",
          '};',
        ].join('\\n');

        const executor = new Function('__deps', '__modules', executorSource);

        const result = executor(
          {
            React,
            ReactDOM: ReactDOMCompat,
            ReactDOMClient: ReactDOMCompat,
          },
          __modules
        );

        const hasManualRender = ${prepared.hasManualRender ? 'true' : 'false'};
        if (!hasManualRender) {
          const mountNode = document.getElementById('root');
          const Component = result.defaultExport ?? result.appExport;
          if (mountNode && typeof Component === 'function') {
            ReactDOMClientModule.createRoot(mountNode).render(React.createElement(Component));
          }
        }
      } catch (error) {
        post('error', { msg: error?.message || String(error) });
      }

      post('ready', {});
    })();
  </script>
</body>
</html>`;
}

function prepareReactCode(source: string): PreparedReactCode {
  const importRewrite = rewriteImports(source);
  const exportRewrite = rewriteDefaultExport(importRewrite.code);

  let runtimeError: string | undefined;
  if (importRewrite.unsupportedRelativeImport) {
    runtimeError = 'Relative imports are not supported in the React sandbox preview.';
  } else if (exportRewrite.unsupportedExport) {
    runtimeError = 'Only default export is supported for React preview. Remove named exports from the snippet.';
  }

  return {
    code: exportRewrite.code,
    hasManualRender: detectManualRender(source),
    moduleSources: importRewrite.moduleSources,
    runtimeError,
  };
}

function rewriteImports(source: string) {
  const moduleSources = new Set<string>(['react', 'react-dom', 'react-dom/client']);
  let unsupportedRelativeImport = false;

  let code = source.replace(
    /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
    (_match, rawSpecifiers: string, rawSource: string) => {
      const sourceName = rawSource.trim();
      const specifiers = rawSpecifiers.trim();
      if (isRelativeModule(sourceName)) {
        unsupportedRelativeImport = true;
        return '';
      }
      if (specifiers.startsWith('type ')) {
        return '';
      }

      moduleSources.add(sourceName);
      return buildImportBindings(specifiers, sourceName);
    }
  );

  code = code.replace(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_match, rawSource: string) => {
    const sourceName = rawSource.trim();
    if (isRelativeModule(sourceName)) {
      unsupportedRelativeImport = true;
      return '';
    }
    moduleSources.add(sourceName);
    return '';
  });

  return {
    code,
    moduleSources: [...moduleSources],
    unsupportedRelativeImport,
  };
}

function buildImportBindings(specifiers: string, sourceName: string) {
  const target = `__modules[${JSON.stringify(sourceName)}]`;
  const statements: string[] = [];
  const trimmed = specifiers.trim();

  if (trimmed.startsWith('* as ')) {
    statements.push(`const ${trimmed.slice(5).trim()} = ${target};`);
    return statements.join('\n');
  }

  const parts = splitImportClause(trimmed);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('type ')) continue;
    if (part.startsWith('{') && part.endsWith('}')) {
      const named = normalizeNamedImports(part.slice(1, -1));
      if (named) statements.push(`const { ${named} } = ${target};`);
    } else {
      statements.push(`const ${part} = ${target}.default ?? ${target};`);
    }
  }

  return statements.join('\n');
}

function splitImportClause(specifiers: string) {
  const parts: string[] = [];
  let buffer = '';
  let depth = 0;

  for (const char of specifiers) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (char === ',' && depth === 0) {
      parts.push(buffer.trim());
      buffer = '';
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
}

function normalizeNamedImports(namedImports: string) {
  return namedImports
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.startsWith('type '))
    .map((item) => {
      const normalizedItem = item.replace(/^type\s+/, '');
      if (!normalizedItem) return '';
      const aliasParts = item.split(/\s+as\s+/);
      return aliasParts.length === 2 ? `${aliasParts[0].trim().replace(/^type\s+/, '')}: ${aliasParts[1].trim()}` : normalizedItem;
    })
    .filter(Boolean)
    .join(', ');
}

function rewriteDefaultExport(source: string) {
  let code = source;
  let unsupportedExport = false;
  let assignedDefault = false;
  let defaultIdentifier: string | null = null;

  code = code.replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/, (_match, name: string) => {
    assignedDefault = true;
    defaultIdentifier = name;
    return `function ${name}(`;
  });
  if (assignedDefault && defaultIdentifier) {
    code += `\n__defaultExport = ${defaultIdentifier};`;
  }

  if (!assignedDefault) {
    code = code.replace(/export\s+default\s+function\s*\(/, () => {
      assignedDefault = true;
      return '__defaultExport = function(';
    });
  }

  if (!assignedDefault) {
    code = code.replace(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)/, (_match, name: string) => {
      assignedDefault = true;
      defaultIdentifier = name;
      return `class ${name}`;
    });
    if (assignedDefault && defaultIdentifier) {
      code += `\n__defaultExport = ${defaultIdentifier};`;
    }
  }

  if (!assignedDefault) {
    code = code.replace(/export\s+default\s+class\b/, () => {
      assignedDefault = true;
      return '__defaultExport = class';
    });
  }

  if (!assignedDefault && /export\s+default\s+/.test(code)) {
    assignedDefault = true;
    code = code.replace(/export\s+default\s+/, '__defaultExport = ');
  }

  if (/\bexport\s+(const|let|var|function|class|\{)/.test(code)) {
    unsupportedExport = true;
  }

  return { code, unsupportedExport };
}

function detectManualRender(source: string) {
  return /\b(createRoot|hydrateRoot)\s*\(|\bReactDOM(?:Client)?\.(createRoot|hydrateRoot|render)\s*\(|\broot\s*\.\s*render\s*\(/.test(source);
}

function buildModuleUrlMap(moduleSources: string[]) {
  const map: Record<string, string> = {};
  for (const source of moduleSources) {
    map[source] = resolveModuleUrl(source);
  }
  return map;
}

function resolveModuleUrl(source: string) {
  if (source === 'react') return REACT_IMPORT_URL;
  if (source === 'react/jsx-runtime') return REACT_JSX_RUNTIME_IMPORT_URL;
  if (source === 'react/jsx-dev-runtime') return REACT_JSX_DEV_RUNTIME_IMPORT_URL;
  if (source === 'react-dom') return REACT_DOM_IMPORT_URL;
  if (source === 'react-dom/client') return REACT_DOM_CLIENT_IMPORT_URL;
  if (/^https?:\/\//.test(source)) return source;
  return `https://esm.sh/${source}?dev&bundle&deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;
}

function isRelativeModule(source: string) {
  return source.startsWith('.') || source.startsWith('/');
}

function serializeForInlineScript(value: string) {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}
