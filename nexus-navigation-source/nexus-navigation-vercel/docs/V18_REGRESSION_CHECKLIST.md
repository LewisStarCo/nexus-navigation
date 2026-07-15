# Nexus v18 Regression Checklist

This checklist protects the Nexus v17 user experience while the internals move to the v18 modular architecture. Complete it before publishing a v18 build.

## Data safety and storage

- [ ] Back up a real `nexus-data-v1` value before the first v18 load.
- [ ] Load an unversioned v17 snapshot and verify every Resource, Category, Event and AI setting remains present.
- [ ] Load a legacy snapshot containing only `links` and verify it becomes Website Resources.
- [ ] Load a legacy snapshot containing `focusTasks` but no `events` and verify the tasks become Events.
- [ ] Load a v17 Event with an empty `endTime` and verify it is rebuilt from `startTime + duration`.
- [ ] Refresh twice after migration and verify the result is stable and `schemaVersion` remains current.
- [ ] Confirm the browser key is still `nexus-data-v1`.
- [ ] Confirm malformed JSON or a future schema version is reported without overwriting the original value.
- [ ] Confirm a valid but unrelated JSON object is rejected as both stored data and an imported backup.
- [ ] Export, clear and import the same data; verify the round trip restores equivalent Nexus data.
- [ ] Confirm an invalid import does not replace the current data.
- [ ] Change data on Home and Calendar, refresh both pages and verify neither page erases the other module's fields.
- [ ] Keep Home and Calendar open in separate tabs and verify an external save is synchronized through the browser storage event.

## Settings

- [ ] Edit the username and verify the greeting updates and survives refresh.
- [ ] Add, remove and reorder time zones; verify the first one controls the greeting.
- [ ] Switch light/dark theme and verify both Home and Calendar remain usable.
- [ ] Select each built-in search engine and add a custom `{query}` engine.
- [ ] Search and verify the result opens in a new browser tab.

## Navigation and Resources

- [ ] Create, edit and delete a Website Resource.
- [ ] Enter an invalid Website URL and verify the form reports it without crashing.
- [ ] Create, edit and delete an Application Resource.
- [ ] Confirm a Website opens in a new tab.
- [ ] Confirm an Application only shows information and is not launched on Web.
- [ ] Add, rename, delete and drag-reorder Categories.
- [ ] Delete a Category and verify its Resources and Event Resource references follow the existing v17 behavior.
- [ ] Add Resources to Unclassified and Temporary; confirm neither appears in normal navigation.
- [ ] Move an Unclassified or Temporary Resource into a regular Category.
- [ ] Clear all Resources in a Category, Unclassified and Temporary.
- [ ] Install/use the existing Edge extension and verify queued captures, Category names and save acknowledgements remain compatible.
- [ ] Confirm AI Category recommendations never apply until the user chooses to adopt one.

## Calendar and Focus

- [ ] Create, edit, delete and complete a Task.
- [ ] Edit a Focus Event's start/end time and verify Calendar shows the recalculated duration.
- [ ] Create, edit, delete and complete a Schedule.
- [ ] Verify Day and Week views.
- [ ] Drag a Task to another time/day and verify its duration is preserved.
- [ ] Confirm Schedule drag behavior is unchanged from v17.
- [ ] Create a non-repeating Event.
- [ ] Create an Event every X weeks with a custom count.
- [ ] Create an Event every X months with a custom count.
- [ ] Edit one occurrence and verify only that occurrence changes.
- [ ] Associate multiple Website/Application Resources by ID.
- [ ] Remove a Resource and verify Event references are cleaned without deleting the Event.
- [ ] Confirm Today's Focus displays associated Resources.
- [ ] Confirm Today's Progress and Weekly Progress match completed Events.
- [ ] Confirm an overdue pending Event becomes unfinished without schema migration changing historical data.

## Calendar import

- [ ] Import Apple/Google/Outlook ICS locally.
- [ ] Import Microsoft To Do CSV, JSON and compatible ICS locally.
- [ ] Choose a date range and verify only in-range items enter Preview.
- [ ] Confirm Preview does not save anything before explicit confirmation.
- [ ] Confirm duplicate filtering and `externalId` behavior remain compatible with v17.
- [ ] Confirm the Google/Microsoft account connection entry points remain visible.
- [ ] Confirm local files are parsed in the browser and are not uploaded.

## AI Planner

- [ ] Save Provider, model and BYOK settings for OpenAI, Qwen, Zhipu AI, DeepSeek, Gemini and Claude.
- [ ] Save a custom OpenAI-compatible Provider with an HTTPS base URL and model ID.
- [ ] Refresh Home and Calendar and verify settings persist.
- [ ] Delete the API Key and verify it stays deleted.
- [ ] Verify Used in Calendar, Used in Category and Used in Planning independently gate requests.
- [ ] Enable Do not use AI in any situation and verify no AI request is sent.
- [ ] Verify Calendar drafts require Adjust/Accept/Add to Calendar confirmation.
- [ ] Verify Category suggestions require explicit adoption.
- [ ] Verify Suggested Resources contain only existing Resource IDs and require Accept/Modify.
- [ ] Verify Ignore never changes Events, Resources, Navigation or Calendar.
- [ ] Verify AI never creates, changes, completes or deletes data without explicit user confirmation.

## Platform boundary

- [ ] Browser capability checks report no Application launch, File Resource or Folder Resource support.
- [ ] Website and search links still open externally through the Browser adapter.
- [ ] No Tauri runtime or Desktop API is bundled into the Web build.
- [ ] The Desktop adapter remains a compile-safe placeholder only.

## Release checks

- [ ] Run the core automated test suite.
- [ ] Run TypeScript checking.
- [ ] Run the production build.
- [ ] Verify `/` and `/calendar` in both light and dark themes.
- [ ] Confirm no page or business module directly calls `localStorage`.
- [ ] Confirm the v18 README explains schema, migrations, adapters and data recovery.
