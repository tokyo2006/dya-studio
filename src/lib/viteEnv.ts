/**
 * Build-time flag for RPC debug logging, isolated in its own module.
 *
 * `import.meta.env` only exists under Vite; the CommonJS Jest runtime can't
 * even parse the `import.meta` token. Keeping the reference here (and nowhere
 * else) lets Jest swap the whole module for a stub via `moduleNameMapper`
 * without every consumer having to guard the access.
 *
 * RPC logging is enabled when either:
 * - running the local `vite dev` server (`import.meta.env.DEV`), or
 * - the build was produced with `VITE_ENABLE_RPC_LOG=true` — the dev and PR
 *   preview Cloudflare Workers deployments (built in `.github/workflows/test.yml`)
 *   set this so their production-mode bundles still log; the real production
 *   release build (`.github/workflows/release.yml`) leaves it unset.
 *
 * Both operands are static, so Vite folds `RPC_LOG_ENABLED` to a literal and
 * tree-shakes the logging branch out of the production release bundle.
 */
export const RPC_LOG_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_RPC_LOG === "true";
