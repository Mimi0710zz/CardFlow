# Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one persisted reminder collection, a top-level CRUD tab, and active-reminder projections on Dashboard and Tracking.

**Architecture:** `services/reminders.js` owns normalization, validation, derived status, and active/card filtering. `app.js` owns CRUD rendering and passes the same normalized collection to Dashboard and tracking UI; `local-repository.js` persists it through the existing canonical pipeline.

**Tech Stack:** Vanilla JavaScript ES modules, HTML/CSS, Node test runner.

**Spec:** User-approved requirements in the current task.

## Global Constraints

- Inclusive local-date range.
- Do not persist derived status.
- Do not duplicate reminders into cards or view-specific state.
- Preserve legacy data and unrelated behavior.

### Task 1: Reminder domain and persistence

**Files:** Create `services/reminders.js`; modify `services/default-data.js`, `services/local-repository.js`; test `tests/reminders.test.mjs`.

- [ ] Write failing tests for normalization, validation, boundary states, card filtering, missing cards, persistence, and deletion projections.
- [ ] Run focused test and confirm RED.
- [ ] Implement minimal domain helpers and canonical persistence.
- [ ] Run focused test and confirm GREEN.

### Task 2: CRUD tab and filtering

**Files:** Modify `index.html`, `app.js`, `styles.css`; test `tests/reminders-ui.test.mjs`.

- [ ] Write failing source/UI tests for navigation, form, table, filters, and CRUD hooks.
- [ ] Run focused test and confirm RED.
- [ ] Implement the tab using existing modal, toolbar, selection, and filter patterns.
- [ ] Run focused test and confirm GREEN.

### Task 3: Dashboard and tracking projections

**Files:** Modify `app.js`, `services/tracking-matrix-ui.js`, `styles.css`; test `tests/reminders-ui.test.mjs`.

- [ ] Write failing tests for Dashboard active-only rendering and card-scoped tracking badges/details.
- [ ] Run focused test and confirm RED.
- [ ] Render shared active reminders without duplicating state.
- [ ] Run focused and full suites, syntax checks, and diff inspection.
