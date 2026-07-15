/**
 * Jest stub for {@link ../viteEnv}. The real module reads `import.meta.env`,
 * which the CommonJS test runtime can't parse. Tests run as a production-like
 * build, so dev-only logging stays off.
 */
export const IS_DEV = false;
