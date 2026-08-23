\# PROJECT MEMORY



This file stores important project decisions, finalized workflows, and reusable patterns.



Always read this file before analysis or implementation.



Do not re-analyze decisions already documented here.



\---



\# GENERAL PRINCIPLES



Always:



\* Reuse existing code.

\* Reuse existing workflows.

\* Reuse existing forms.

\* Reuse existing services.



Avoid creating duplicate implementations.



Modify minimum files possible.



\---



\# DATAGRIDVIEW STANDARD



This workflow is finalized.



Always reuse existing implementation.



Selection:



\* MultiSelect = true

\* FullRowSelect = true



Mouse:



\* Click row = select row

\* Ctrl + Click = multi-select

\* Shift + Click = range select



Checkbox:



\* Click checkbox inside selected group

&#x20; -> apply to whole group



\* Click checkbox outside selected group

&#x20; -> apply only clicked row



Keyboard:



\* Space = toggle checkbox

\* Ctrl+C = copy current cell only

\* Ctrl+V = paste current cell only



Do not implement alternative behaviors unless explicitly requested.



\---



\# STATUS COLUMN RULE



Only update status when value actually changes.



If value unchanged:



\* Keep previous status

\* Keep previous highlight



If value changed:



\* Update status

\* Update highlight



\---



\# UI PRINCIPLES



Preferred:



\* Premium Dark Theme

\* Compact Layout

\* Minimal Popups



Always provide:



\* Preview

\* Progress Form

\* Status Feedback



Avoid:



\* Excessive MessageBoxes

\* Blocking UI



\---



\# MINHLISP



Main Assembly:



Minh.Lisp.dll



Architecture:



\* Service-based

\* Reusable Forms

\* Reusable Helpers



Current Tools:



\## ALB



Auto Layout By Title Block



Completed:



\* Layout Creation

\* Batch Plot PDF

\* Layout Selection Form



Key Decision:



Use existing LayoutSelectionForm workflow.



\---



\## MLRL



Rename Layout



Completed:



\* Replace Mode

\* Rename Mode

\* Preview Mode



Key Decision:



MLRL becomes standard pattern for future batch rename tools.



\---



\## MLRS



Rename Sheet Number / Sheet Name



Key Decision:



Reuse:



\* MLRL workflow

\* DataGridView workflow

\* Progress Form workflow



Avoid creating a separate architecture.



\---



\# MINHTOOLS REVIT



Supported:



\* Revit 2025

\* Revit 2026



Future:



\* Revit 2027

\* Revit 2028



\---



\# OPTIMIZE WORKFLOW



Current Stable Workflow:



1\. PurgeUnusedService

2\. CAD Cleanup

3\. Empty View Cleanup

4\. Material Cleanup



Preferred Purge:



3 rounds



\---



\# CAD CLEANUP



Options:



\* Delete CAD Links

\* Delete CAD Imports



\---



\# MATERIAL CLEANUP



Delete:



\* Unused Materials

\* Physical Assets

\* Thermal Assets



\---



\# SAVE AS WORKFLOW



Current stable implementation must be reused.



Do not redesign without explicit request.



\---



\# RELEASE MANAGER



Current Product Types:



\* Revit

\* AutoCAD

\* Windows App



Key Decision:



All future tools should remain compatible with Release Manager workflow.



\---



\# WINDOWS APPS



Current Applications:



\* Release Manager

\* BulkCCApp

\* LicenseKit

\* QuanLyCDE

\* Tool Tao De Thi



Preferred Architecture:



\* Reusable Services

\* Reusable Controls

\* Reusable Dialogs



\---



\# IMPLEMENTATION STRATEGY



Before coding:



1\. Search existing implementation.

2\. Search existing service.

3\. Search existing form.

4\. Search existing helper.

5\. Search existing workflow.



Reuse first.



Create new implementation only when necessary.



\---



\# RESPONSE LANGUAGE



Always respond in Vietnamese.



Only source code may remain in English.



\---



\# TRUTHFULNESS



Never claim:



\* Build succeeded

\* Tests passed

\* Feature verified



unless actually verified.



Use:



\[Chưa xác minh]



when verification was not performed.



