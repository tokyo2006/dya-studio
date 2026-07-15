/**
 * Build-time environment flags, isolated in their own module.
 *
 * `import.meta.env` only exists under Vite; the CommonJS Jest runtime can't
 * even parse the `import.meta` token. Keeping the reference here (and nowhere
 * else) lets Jest swap the whole module for a stub via `moduleNameMapper`
 * without every consumer having to guard the access.
 *
 * Vite statically replaces `import.meta.env.DEV`, so `IS_DEV` folds to a
 * literal and dev-only branches are tree-shaken out of production bundles.
 */
export const IS_DEV: boolean = import.meta.env.DEV;
