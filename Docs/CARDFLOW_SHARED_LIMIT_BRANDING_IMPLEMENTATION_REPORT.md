# CardFlow Shared Limit & Branding Implementation Report

## Files modified

- `index.html`
- `styles.css`
- `app.js`
- `services/local-repository.js`
- `services/sync-service.js`
- `Docs/CARDFLOW_SHARED_LIMIT_BRANDING_IMPLEMENTATION_REPORT.md`

## Schema changes

Cards now support the internal field:

- `limitGroupId`

Existing compatibility fields remain:

- `limitGroup`
- `groupLimit`

The normal UI does not expose raw `limitGroupId` values.

## Shared-limit data model

The shared-limit relationship is represented by cards sharing the same `limitGroupId`.

No duplicated pairwise field such as `sharedWith` was added.

For compatibility, `groupLimit` remains on each card. When cards are in the same shared group, the app keeps the visible repeated `groupLimit` synchronized while treating the group limit as one logical value.

## Migration behavior

Existing legacy `limitGroup` values are converted into stable `limitGroupId` values:

- `SCB-SHARED` -> `LG-SCB-SHARED`
- independent legacy card groups -> `LG-<LEGACY_GROUP>`

Migration preserves:

- existing Card IDs
- existing `limitGroup`
- existing `groupLimit`
- cashback references
- transaction references
- payment references

Migration is idempotent and does not duplicate groups on reload.

## Add/Edit shared-limit workflow

Credit Card Add/Edit now includes:

`Dùng chung hạn mức`

Control:

- multi-select picker
- includes `Không`
- lists previously created cards only
- excludes the current card when editing

Rules:

- `Không` means independent limit.
- selecting a card clears `Không`.
- selecting `Không` clears shared card selection.
- selected cards must resolve to one existing limit group.
- cards from different groups are rejected with:
  `Các thẻ đã chọn đang thuộc các nhóm hạn mức khác nhau. Vui lòng chọn các thẻ trong cùng một nhóm hạn mức.`

When sharing with existing cards, the limit input becomes read-only and inherits the existing group limit.

Latest cleanup:

- removed normal-user editable `Nhóm hạn mức` from the Credit Card Add/Edit form
- visible Credit Card field order is now:
  1. Ngân hàng
  2. Tên thẻ
  3. Loại thẻ
  4. Hình thức thẻ
  5. Ngày sao kê
  6. Dùng chung hạn mức
  7. Hạn mức nhóm (VND)
- selectable shared-limit cards display as `<Ngân hàng> - <Tên thẻ>`
- `Không` is exclusive: selecting `Không` clears selected cards, and selecting cards clears `Không`

## Group-limit calculation behavior

Dashboard limit logic now uses `limitGroupId` generally instead of hardcoded `SCB-SHARED`.

For a shared group:

- group outstanding balance = sum of member card balances
- remaining limit = one group limit minus total group outstanding
- the same group limit may be displayed per card for readability
- unrelated financial calculations are unchanged

## Delete behavior

Deleting a card removes only that card.

After deletion:

- remaining shared members are preserved
- if a group has only one card left, that card is repaired into an independent group
- transactions, cashback programs, and payments are not rewritten

## Branding changes

User-facing branding changed from `CardFlow` to:

`QUẢN LÝ THẺ TÍN DỤNG`

Applied to:

- browser document title
- sidebar brand
- main header
- Google Drive login gate
- onboarding welcome text

Technical identifiers were not renamed.

## Author/header changes

Added author line:

`NGUYỄN QUANG MINH`

It is shown as secondary text in the sidebar, main header, and login gate.

## Tests executed/results

Executed:

- `node --check app.js`
- `node --check services/local-repository.js`
- `node --check services/sync-service.js`
- `node --check services/default-data.js`
- `node --check services/card-id.js`

Module tests:

- legacy shared group migrates to one `limitGroupId`
- independent legacy card gets independent `limitGroupId`
- existing Card IDs remain unchanged
- legacy `groupLimit` values are preserved
- shared-limit migration is idempotent
- Sacombank mapping remains `SACOM`

Browser smoke test at `http://127.0.0.1:5173`:

- document title is `QUẢN LÝ THẺ TÍN DỤNG`
- app name is visible
- `NGUYỄN QUANG MINH` is visible
- login gate remains visible before Drive connection
- app shell is locked before connection
- no browser console errors observed

Additional source/syntax checks:

- searched `app.js` and `index.html` for visible `Nhóm hạn mức`
- confirmed only internal `limitGroup/limitGroupId` references remain
- confirmed `Dùng chung hạn mức` is present in Credit Card form/table source
- `node --check app.js` passed after the cleanup

Not fully runtime-tested:

- live Add/Edit shared-limit picker interactions after real Google Drive unlock
- real Google OAuth/Drive sync
- multi-device Drive conflict scenario
- mobile physical-device interaction

## Manual runtime tests still required

- Connect Google Drive with the configured OAuth client.
- Add an independent card with `Không`.
- Add a new card sharing one existing card.
- Add a new card joining an existing multi-card group.
- Select multiple cards from the same group.
- Confirm different groups are rejected.
- Edit shared -> `Không`.
- Edit one shared group -> another group.
- Delete one card from a shared group.
- Verify group outstanding and remaining limit with real transactions/payments.
- Test mobile multi-select usability.
- Test deployed GitHub Pages URL.

## GitHub Pages compatibility status

The app still uses relative paths:

- `styles.css`
- `cardflow.config.js`
- `app.js`
- `services/*.js`

No backend, client secret, OAuth Client ID change, or non-GitHub-Pages path was added. GitHub Pages compatibility is preserved structurally. Live deployed runtime was not tested.
