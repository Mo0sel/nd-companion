# N&D Companion development

These instructions apply throughout this repository. Read DEVELOPMENT_GUIDE.md,
PRODUCT_PRINCIPLES.md, and RELEASE.md for the existing architecture and workflow.

- Runtime: plain JavaScript, Handlebars, ApplicationV2, and CSS for Foundry V14.
  Do not introduce React, TypeScript, Tailwind, or Vite into the module runtime.
- Refine the existing visual design. Keep design/ and historical Figma exports
  as references; they are not runtime dependencies.
- Foundry documents remain authoritative. Use the existing service engines and
  CompanionStorage; do not create a second persistence path in UI code.
- Preserve editor DOM, focus, selection, drafts, and autosave bindings on routine
  refreshes. Flush pending edits before rebinding an editor to another record.
- Use stable record IDs for delayed saves. Never silently discard failed saves.
- Preserve manual UI choices through workspace switches and ordinary repaints.
- AI proposes campaign changes; the DM reviews and approves them.
- Use official Foundry V14 APIs and hooks rather than polling.
- For Play changes, run npm run test:play (see docs/WORKFLOW.md for setup).
- For packaging changes, run npm run test:package.
- Finish work with npm run dev-build. Inspect the resulting package and report
  what still requires live Foundry/Forge testing.
- "Finish Sprint" does not authorize a release. Do not bump versions, tag, push,
  or publish unless the user explicitly asks to release. Use npm run release
  only for an authorized release, then verify the GitHub Action and assets.
- Keep module.json as the version source of truth. A push to main alone does
  not publish a Forge-installable release.
- Browser previews with mocked Foundry services are useful for UI regression
  checks, but do not establish real-world Foundry compatibility.

See docs/WORKFLOW.md for the ChatGPT development handoff and live test checklist.
