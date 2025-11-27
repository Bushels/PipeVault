# AI Implementation Reference

This guide is for AI assistants working on PipeVault so existing structures are reused instead of rebuilt.

## Entry Points
- `App.tsx` routes users: unauthenticated visitors land on `components/WelcomeScreen.tsx`; authenticated sessions render `components/Dashboard.tsx`.
- `components/WelcomeScreen.tsx` hosts the four customer quick-action buttons and handles unauthenticated workflows.
- `components/Dashboard.tsx` is the logged-in customer hub. It renders `components/StorageRequestMenu.tsx` for the quick actions plus the storage wizard and chat flows.

## Reusing Existing UI
- Quick action cards are defined once in `components/StorageRequestMenu.tsx`; the public welcome view mirrors the same structure. Update both if visuals change.
- Icons live in `components/icons/Icons.tsx`. Prefer adding/updating icons here and importing them where needed instead of defining ad-hoc SVGs.
- Shared UI primitives (`Button`, `Card`, etc.) are under `components/ui/`. Use them to keep spacing and theming consistent.

## Data + Auth Overview
- Authentication context is provided by `lib/AuthContext.tsx`. Components access the user via the `useAuth()` hook.
- Storage requests, inventory, and documents share TypeScript types under `types.ts` and are passed top-down from `App.tsx`.

## Working Tips for AI Agents
- Before creating new files, search (`rg`) for existing components that already implement similar functionality.
- When adjusting customer-facing quick actions, modify both `WelcomeScreen` and `StorageRequestMenu` to keep authenticated and unauthenticated experiences in sync.
- Keep Tailwind utility ordering consistent with existing code to avoid churn in diffs.
- Document non-obvious architecture decisions in `CHANGELOG.md` or inline comments only when necessary.
