# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project. Application routes and global styles live in `app/`; the root page is `app/page.tsx`, shared layout and metadata are in `app/layout.tsx`, and Tailwind/shadcn theme tokens are in `app/globals.css`. Reusable UI components belong under `components/`, with generated shadcn components in `components/ui/`. Shared utilities live in `lib/`, for example `lib/utils.ts`. Static assets such as SVGs and icons belong in `public/`. There is no dedicated test directory yet; add tests close to the feature or under a future `tests/` directory once a test runner is introduced.

## Build, Test, and Development Commands

Use pnpm, since this repository includes `pnpm-lock.yaml`.

- `pnpm dev`: start the local Next.js development server.
- `pnpm build`: create a production build and run Next.js validation.
- `pnpm start`: serve the production build after `pnpm build`.
- `pnpm lint`: run ESLint with the Next.js core-web-vitals and TypeScript rules.

## Coding Style & Naming Conventions

Write TypeScript and React function components. Use the `@/` path alias for local imports. Prefer server components by default; add `"use client"` only for browser-only hooks, state, or event handlers. Keep component files in PascalCase when adding app-specific components, and keep shadcn-style primitives in lowercase files under `components/ui/`. Use Tailwind utility classes for styling and `cn()` from `lib/utils.ts` when merging conditional classes. Follow the existing ESLint configuration and run `pnpm lint` before submitting changes.

## Testing Guidelines

No automated test framework is configured at the moment. For now, rely on `pnpm lint` and `pnpm build` as required checks. When adding tests, document the new command in `package.json`, use clear `*.test.ts` or `*.test.tsx` names, and cover user-facing behavior rather than implementation details.

## Commit & Pull Request Guidelines

The current history only contains `init`; keep future commit subjects short, imperative, and scoped to one change, such as `add editor toolbar`. Pull requests should include a concise summary, validation steps run, linked issues when applicable, and screenshots or screen recordings for visual UI changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Keep public assets in `public/`, and place server-only configuration in environment variables consumed by Next.js.

## Plan Mode

After performing plan mode, write summarization MD file about plan in `docs/`.

## After Implementation

Summarize implementation and append it in `history.json` file in `docs/`. Add prompts which user insert to that file.