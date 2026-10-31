import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
export function loadRoute(relative, mocks) {
  const source = readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: relative,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const routeModule = { exports: {} };
  vm.runInNewContext(code, {
    module: routeModule,
    exports: routeModule.exports,
    require(name) {
      if (!(name in mocks)) throw Error('Missing mock ' + name);
      return mocks[name];
    },
    fetch:
      mocks.fetch ||
      (() => {
        throw Error('Unexpected test network request');
      }),
    navigator: mocks.navigator || {},
    window: mocks.window,
    document: mocks.document,
    location: mocks.location,
    localStorage: mocks.localStorage,
    sessionStorage: mocks.sessionStorage,
    setInterval: mocks.setInterval || setInterval,
    clearInterval: mocks.clearInterval || clearInterval,
    setTimeout,
    clearTimeout,
    AbortController,
    Event,
    Date: mocks.Date || Date,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    crypto,
    AbortSignal,
    console,
  });
  return routeModule.exports;
}
