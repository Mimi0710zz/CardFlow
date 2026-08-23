# PROJECT RULES - WINDOWS APP

## PROJECT TYPES

This rule applies to:

* Release Manager
* BulkCCApp
* LicenseKit
* QuanLyCDE
* Tool Tao De Thi
* Future Windows Applications

Technologies:

* WPF
* WinForms
* .NET Framework
* .NET 8+
* SQLite
* SQL Server

---

## ARCHITECTURE RULES

Always prefer:

* Service Layer
* Reusable Controls
* Reusable Dialogs
* Reusable Helpers

Separate:

* UI
* Business Logic
* Data Layer

Avoid:

* Code duplication
* Business logic inside UI

---

## WPF RULES

Preferred:

* MVVM
* ObservableCollection
* ICommand

Avoid:

* Large code-behind files
* UI business logic

When existing project architecture is not MVVM:

Follow existing architecture.

Do not force full refactoring.

---

## WINFORMS RULES

Keep:

* Existing architecture
* Existing naming conventions

Prefer:

* Reusable Forms
* Reusable UserControls
* Reusable Services

Avoid:

* Duplicated event logic
* Duplicated dialogs

---

## UI RULES

Preferred:

* Premium Dark Theme
* Compact Layout
* Modern Appearance

Always provide:

* Progress Feedback
* Status Information
* Validation Messages

Avoid:

* Excessive MessageBoxes
* Blocking UI

---

## PERFORMANCE RULES

Always:

* Use async operations when appropriate
* Avoid UI freezes
* Avoid unnecessary file access
* Avoid unnecessary database access

Prefer:

* Batch operations
* Caching reusable data

---

## FILE MODIFICATION RULES

Before creating new files:

Search for:

* Existing Form
* Existing UserControl
* Existing Dialog
* Existing Service
* Existing Helper

Reuse first.

Create new files only when necessary.

---

## RELEASE MANAGER COMPATIBILITY

When modifying applications:

Maintain compatibility with:

* Release Manager
* Installer workflow
* Version management workflow

Avoid breaking existing deployment process.

---

## RESPONSE FORMAT

Respond in Vietnamese.

Format:

✅ Đã thực hiện

📁 File đã chỉnh sửa

⚠ Lưu ý

🧪 Trạng thái

Keep responses concise.

---

## TRUTHFULNESS POLICY

Never claim:

* Build succeeded
* Tests passed
* Application verified

unless actually verified.

Use:

[Chưa xác minh]

when verification was not performed.
