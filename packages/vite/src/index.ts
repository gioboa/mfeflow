import path from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin, PluginOption, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation, type ModuleFederationOptions } from '@module-federation/vite';
import {
  assertAsyncBoundary,
  commonRemoteOptions,
  commonShellOptions,
  installedVersionFrom,
  resolvableFrom,
  shellDefines,
  type CommonFederationOptions,
  type RemoteOptions,
  type ShellOptions,
} from '@mfeflow/bundler-shared';
import { pluginHeadScripts } from './head-scripts';
import { pluginRuntimeConfig } from './runtime-config';

export { pluginHeadScripts, registerHeadScript } from './head-scripts';
export { pluginRuntimeConfig } from './runtime-config';
export { pluginRestartOn } from './restart';
export {
  DEFAULT_SINGLETONS,
  RUNTIME_CONFIG_URL,
  appVersion,
  assertAsyncBoundary,
  installedVersionFrom,
  packageNameOf,
  resolvableFrom,
  runtimeConfigEnv,
  runtimeConfigEnvs,
  runtimeConfigHandler,
  sharedPackages,
  sharedSingletons,
  snapshotEnabled,
  type RemoteOptions,
  type SharedConfig,
  type ShellOptions,
} from '@mfeflow/bundler-shared';

/** The remote entry file name, the same as the Rsbuild preset emits. */
export const REMOTE_ENTRY = 'remoteEntry.js';

export interface FederationOptions extends CommonFederationOptions {
  filename?: string;
  experiments: { externalRuntime?: true; provideExternalRuntime?: true };
}

/** Module Federation options for a remote. Exported for tests and custom setups. */
export function remoteFederationOptions(
  o: RemoteOptions,
  canResolve: (s: string) => boolean,
  versionOf?: (s: string) => string | undefined,
): FederationOptions {
  return {
    ...commonRemoteOptions(o, canResolve, versionOf),
    filename: REMOTE_ENTRY,
    // The shell provides the Module Federation runtime; remotes do not bundle their own.
    experiments: { externalRuntime: true },
  };
}

/** Module Federation options for a shell. Exported for tests and custom setups. */
export function shellFederationOptions(
  o: ShellOptions,
  canResolve: (s: string) => boolean,
  resolvePath: (s: string) => string,
  versionOf?: (s: string) => string | undefined,
): FederationOptions {
  return {
    ...commonShellOptions(o, canResolve, resolvePath, versionOf),
    experiments: { provideExternalRuntime: true },
  };
}

function isPlugin(value: unknown): value is Plugin {
  return typeof value === 'object' && value !== null && 'name' in value;
}

function federationPlugin(options: FederationOptions): PluginOption {
  const mf: ModuleFederationOptions = options;
  // `federation()` is typed `any[]`; it returns Vite plugins.
  const plugins: unknown[] = federation(mf);
  return plugins.filter(isPlugin);
}

/** A fixed port that fails when taken, so `mfeflow dev` and the registry agree on it. The host stays Vite's default, as in Rsbuild. */
function listen(port: number | undefined): { port?: number; strictPort?: true } {
  return port === undefined ? {} : { port, strictPort: true };
}

function remoteServer(port: number | undefined): NonNullable<UserConfig['server']> {
  // A remote's modules are fetched by the shell's page, so they need absolute URLs back to this server.
  return port === undefined
    ? listen(port)
    : { ...listen(port), origin: `http://localhost:${String(port)}` };
}

/**
 * Vite config for a remote. `vite.config.ts`: `export default createRemoteConfig({ name, exposes })`.
 * `consumesRemotes` has no effect: `@module-federation/vite` has no switch to strip remote support
 * from a remote's entry.
 */
export function createRemoteConfig(o: RemoteOptions): UserConfig {
  const cwd = o.cwd ?? process.cwd();
  return {
    root: cwd,
    // Assets resolve relative to wherever the remote entry was loaded from (versioned CDN paths).
    base: './',
    // Rsbuild exposes PUBLIC_* to the browser; keep that, and Vite's own prefix.
    envPrefix: ['PUBLIC_', 'VITE_'],
    plugins: [
      react(),
      federationPlugin(remoteFederationOptions(o, resolvableFrom(cwd), installedVersionFrom(cwd))),
    ],
    build: { target: 'esnext' },
    server: remoteServer(o.port),
    preview: listen(o.port),
  };
}

/** Defines the shell's compile-time constants once Vite knows whether it is building for production. */
function pluginShellDefines(o: ShellOptions, cwd: string): Plugin {
  return {
    name: 'mfeflow:shell-defines',
    config(_config, { command, mode }) {
      const production = command === 'build' && mode === 'production';
      const env = {
        ...(o.env ?? process.env),
        NODE_ENV: production ? 'production' : 'development',
      };
      return { define: shellDefines({ ...o, env }, cwd, resolvableFrom(cwd)) };
    },
  };
}

/** Vite config for the shell (host). The app root needs an `index.html` that loads `/src/index.ts`. */
export function createShellConfig(o: ShellOptions): UserConfig {
  const cwd = o.cwd ?? process.cwd();
  const require = createRequire(path.join(cwd, 'package.json'));
  if (o.eager === false) assertAsyncBoundary(path.join(cwd, 'src/index.ts'));
  const env = o.env ?? process.env;
  return {
    root: cwd,
    // Client-side routing: unknown paths get index.html.
    appType: 'spa',
    envPrefix: ['PUBLIC_', 'VITE_'],
    plugins: [
      react(),
      federationPlugin(shellFederationOptions(o, resolvableFrom(cwd), (s) => require.resolve(s))),
      pluginShellDefines(o, cwd),
      pluginHeadScripts(),
      pluginRuntimeConfig(cwd, env),
    ],
    build: { target: 'esnext' },
    server: listen(o.port),
    preview: listen(o.port),
  };
}
