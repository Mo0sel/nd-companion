# Development handoff

The editable repository is the development source of truth. Work on its real
Foundry templates, styles, and JavaScript. Keep the established design tokens and
Figma exports as reference material. Proposals, code changes, and browser previews
can be reviewed together before testing a development package in Foundry.

Keep this repository in a persistent local project when continuing development.
The surrounding N&D Ravnica sources/ directory is synced reference material and
must not be edited. No Cursor or Figma file needs to be deleted to work here.

## Commands

- `npm run validate`: syntax, static imports, and package integrity.
- `npm run test:package`: isolated packaging fixtures, including absent optional
  assets, present assets, and an invalid assets path. Requires only Node.
- `npm run test:play`: browser tests against the real Play cards, styles, and
  editing code, with simulated Foundry storage.
- `npm run dev-build`: validation and a local build/module.zip; no version bump,
  commit, push, tag, or release.

For browser tests, run `npm install`, then `npx playwright install chromium`.
Alternatively set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome.
Optional `ND_TEST_SCREENSHOTS` selects a folder for wide and narrow screenshots.
Playwright is development tooling only and is excluded from the runtime ZIP.

## Editable quest cards and images

- The Play heading is the editable quest name. Click a card's title or body to
  edit it; changes autosave. The (+) button creates a blank card. The (−) button
  removes one, with Undo remove available for the most recent removal until
  switching quests or closing the panel.
- Split into cards separates paragraphs or top-level bullets. Nested objective
  and reward lists stay together inside their parent bullet. New split titles
  are blank and editable. Existing image attachments remain on the original card.
- Choose / upload image opens the configured Foundry FilePicker, including
  Forge's implementation when configured. Select an existing image or use the
  picker's upload controls, then select the uploaded image. Images are stored
  through Foundry/Forge; the quest stores only the returned file path.
- Preview opens the image privately. Show to players explicitly sends only the
  image to connected non-GM users. Private card titles and text are not sent.
  Removing an image or card only unlinks it; it does not delete the uploaded file.
- Legacy fields become editable cards without duplicating their text. Linked
  cards continue reading/writing their original quest field. Custom cards live
  on the canonical Campaign quest (or the legacy beat for standalone beats).
  `cards: null` means legacy defaults; `cards: []` means intentionally no cards.
  Card data and image paths survive normalization and campaign export/import.
- Quest-card content is included in entity Copilot context and the session
  wrap-up collector. Image files are not sent to an AI provider by this feature.

## Retained behavior

- Play cards use fixed vertical stacks, becoming one column in narrow windows.
  DOM and keyboard order follow the left stack, then the right stack. Cards do
  not rebalance when a neighbour expands.
- Empty cards initially collapse. Manual choices are retained per beat on the
  current Play panel and survive workspace switches and ordinary repaints.
  Closing/reopening the window restores automatic defaults.
- Newly populated sections open unless manually collapsed. Empty headers remain
  available. A focused editor is not automatically collapsed during repaint.
- Repaints preserve focused or unsaved editors and their autosave bindings.
  Beat changes wait for pending editor saves before replacing their contents.
  Failed saves keep the draft visible and show a notification. Delayed saves
  resolve the beat by ID so playlist reordering cannot change their destination.
- Optional assets/ is skipped only when absent. Invalid paths and read failures
  still fail packaging.

## Foundry V14 / Forge smoke test before release

1. Install the development ZIP in a test instance using the appropriate package
   import workflow, or unpack it into local Data/modules/nd-companion. The ZIP
   has module.json at its root. Enable the module and hard-refresh the client.
2. Confirm the GM launcher opens Companion without module errors in the console.
3. Open an existing quest. Confirm its old notes are preserved as editable cards.
   Rename the quest and a card, reload, and verify the changes persisted.
4. Collapse a filled card, open an empty one, switch to Dashboard and back, then
   switch beats and return. Confirm the choices are retained per beat.
5. Type a reward or note and immediately switch beats. Return and confirm the
   draft saved to the original beat. Check autosave after workspace switches.
6. Expand a tall card. Other cards should stay in their column. Resize narrow;
   cards should stack without horizontal overflow.
7. Use Tab, Enter, and Space on card headers. Add a blank card, type content,
   remove it, and undo. Split a bullet list containing nested lists.
8. Confirm the existing auto-collapse preference, NPC/reference links, session
   switching, and End Session review still behave correctly in the real world.
9. Choose/upload an image in Forge. Confirm it appears and persists after reload.
   Preview privately, then Show to players with a connected player client.
   Confirm the player receives the image, without the card title or notes.
10. Remove the image link and verify the uploaded file still exists in the picker.

Browser tests mock the storage, FilePicker, and ImagePopout boundaries. They verify
the integration calls and UI behavior, not live Forge uploads or network delivery.

Development builds retain the current module.json version. Their filename/version
may not distinguish them from the published release; install the local build file
explicitly for testing.

## Release boundary

Publishing requires an explicit release request. RELEASE.md remains the release
procedure. The stable-manifest update and GitHub validation improvements identified
in the review are separate follow-up work and are not included in this sprint.

## Desktop visual layout

Play uses a dedicated quest rail beside the app navigation. Quest rows select
existing session beats by stable ID; the plus button adds a blank quest to the
session. Navigation flushes pending edits and stays on the draft if saving fails.
Session context and Active Story Threads remain available in expandable sections
of that rail. The main pane begins with the selected quest and its cards.

The final scoped nd-desktop.css layer supplies the charcoal shell, gray cards,
compact monospaced headings, system body typography, lavender selection, and cyan
card titles. Inline SVG icons do not require a host icon font. Card headers offer
image selection, edit, and removal; More contains splitting and image unlinking.
Image preview and explicit sharing remain available below attached images.

The Play browser check renders the real header, navigation, and complete Play
markup, rather than just the isolated card region. It exercises sidebar draft
handling and responsive layout. Foundry/Forge theme interaction still needs a
live-world check after installing the release.
