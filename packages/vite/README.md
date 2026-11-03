# @mfeflow/vite

Vite presets for Module Federation 2.0 micro-frontends, on [`@module-federation/vite`](https://github.com/module-federation/vite). `createShellConfig` and `createRemoteConfig` return a Vite config with React, the shared singletons, the manifest, generated types and the mfeflow runtime plugins already set up. They are the Vite counterpart of `@mfeflow/rsbuild` and take the same options.

## Install

```sh
pnpm add -D @mfeflow/vite vite
```

`vite` (^8.0.0) is a peer dependency.

## Usage

```ts
// vite.config.ts of a remote
import { createRemoteConfig } from '@mfeflow/vite';

export default createRemoteConfig({
  name: 'cart',
  port: 4312,
  exposes: { './App': './src/exposed/App.tsx' },
});
```

```ts
// vite.config.ts of the shell
import { createShellConfig } from '@mfeflow/vite';

export default createShellConfig({ name: 'storefront', port: 4300 });
```

Each app needs an `index.html` at its root that loads `/src/index.ts`. Merge extra settings with `mergeConfig` from `vite`. `pluginRestartOn(path)` restarts the dev server when a file changes (the shell uses it for the dev registry), and `registerHeadScript` puts an inline script first in the shell's `<head>`.

`PUBLIC_*` and `VITE_*` variables reach the browser through `import.meta.env`.

## Module Federation sharing

Bucket: **config**. Used at build, lint or test time only, never shipped to the browser, so it is not shared through Module Federation.

## Links

- [mfeflow repository](https://github.com/mfeflow/mfeflow) and its README
- [Documentation](https://mfeflow.github.io/mfeflow/)

MIT licensed.
