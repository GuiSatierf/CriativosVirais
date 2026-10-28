# shadcn styles

`tailwind.css` is an unchanged copy of `shadcn@4.22.1/dist/tailwind.css`, the version previously pinned in the lockfile. Its MIT license is preserved in `LICENSE.md`.

The app imports this local file from `src/app/globals.css` so builds do not require the shadcn CLI or its transitive dependencies. Keep the import in its current order.

Use `npx shadcn@latest add <component>` when adding components. Review generated changes, keep this local import, and do not add the CLI as a project dependency. To update these styles, copy the CSS and license from the chosen CLI version, update this provenance, and compare the compiled CSS before and after.
