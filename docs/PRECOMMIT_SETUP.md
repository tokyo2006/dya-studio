# Pre-commit Hooks Setup

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to ensure code quality before commits.

## What runs on pre-commit?

1. **Formatting**: Prettier formats staged files (`.ts`, `.tsx`, `.json`, `.md`, `.yml`, `.yaml`)
2. **Linting**: ESLint checks and auto-fixes staged TypeScript files
3. **Testing**: Full test suite runs to ensure nothing is broken

## How it works

When you run `git commit`, the pre-commit hook automatically:

- Runs `lint-staged` to format and lint only the staged files
- Runs `npm test` to verify all tests pass
- If any step fails, the commit is aborted

## Manual commands

You can also run these checks manually:

```bash
# Format all files
npm run format

# Check formatting without changing files
npm run format:check

# Run linting
npm run lint

# Run tests
npm test
```

## First-time setup

If you clone this repository, run:

```bash
npm install
```

This will automatically set up Husky hooks via the `prepare` script.

## GitHub Actions

The project includes a Copilot workflow (`.github/workflows/copilot.yml`) that runs:

- Format check
- Lint
- Tests
- Build

This ensures all code quality checks pass in CI/CD.
