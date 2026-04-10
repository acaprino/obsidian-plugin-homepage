# Review Scope

## Target

Full Obsidian plugin codebase -- Homepage Blocks plugin. Composable drag-and-drop homepage using GridStack for layout, TypeScript + Obsidian DOM API. 16 block types, responsive grid, edit mode, auto-height, lightbox, inline editing.

## Files

### Core
- src/main.ts
- src/HomepageView.ts
- src/GridLayout.ts
- src/EditToolbar.ts
- src/types.ts
- src/BlockRegistry.ts

### Blocks (16)
- src/blocks/BaseBlock.ts
- src/blocks/BookmarkBlock.ts
- src/blocks/ButtonGridBlock.ts
- src/blocks/ClockBlock.ts
- src/blocks/EmbeddedNoteBlock.ts
- src/blocks/FolderLinksBlock.ts
- src/blocks/GreetingBlock.ts
- src/blocks/HtmlBlock.ts
- src/blocks/ImageGalleryBlock.ts
- src/blocks/PomodoroBlock.ts
- src/blocks/QuotesListBlock.ts
- src/blocks/RandomNoteBlock.ts
- src/blocks/RecentFilesBlock.ts
- src/blocks/SpacerBlock.ts
- src/blocks/StaticTextBlock.ts
- src/blocks/VideoEmbedBlock.ts
- src/blocks/VoiceDictationBlock.ts

### Utilities
- src/utils/FolderSuggestModal.ts
- src/utils/blockStyling.ts
- src/utils/dragReorder.ts
- src/utils/emojiPicker.ts
- src/utils/emojis.ts
- src/utils/noteContent.ts
- src/utils/responsiveGrid.ts
- src/utils/tags.ts

### Styles
- styles.css

## Flags

- Deep Dive: no
- Security Focus: no
- Performance Critical: no
- Strict Mode: no
- Distributed: no
- Framework: Obsidian (auto-detected)

## Review Phases

1. Code Audit (Architecture + Failure Flow + Pattern Analysis + Scoring)
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
