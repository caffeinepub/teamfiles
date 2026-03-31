# TeamFiles

## Current State
The app has folders, files, and documents stored on-chain. Users can create, delete, and move items. There is no way to rename folders, files, or documents after creation.

## Requested Changes (Diff)

### Add
- `renameFolder(folderId, newName)` backend function
- `renameFile(fileId, newName)` backend function
- `renameDocument(docId, newTitle)` backend function
- Inline rename UI: double-click or right-click context menu "Rename" on folders, files, and documents
- Inline editable text field with confirm/cancel for rename

### Modify
- App.tsx: wire rename UI to the three new backend calls

### Remove
- Nothing

## Implementation Plan
1. Add three rename functions to main.mo
2. Update frontend to expose rename via double-click inline edit or a rename button in the item's action menu
