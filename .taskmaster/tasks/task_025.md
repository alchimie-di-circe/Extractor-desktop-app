# Task ID: 25

**Title:** Brand Elements Kit -- Folder Structure + Asset Management UI

**Status:** pending

**Dependencies:** 12

**Priority:** medium

**Description:** Restructure brand folder to separate knowledge (RAG-indexed) from elements (graphic assets, NOT indexed). Implement asset management UI in Brands tab. Auto-extract color palette from logos.

**Details:**

1. Restructure from `python/brands/slowfood/` to `python/brands/BRAND-1/`:
   ```text
   python/brands/{brand-slug}/
   ├── knowledge/           # RAG-indexed documents
   │   ├── brand-sheet.md   # tone, USP, UVP
   │   ├── competitors.md
   │   └── guidelines.pdf
   ├── elements/            # NOT indexed in RAG
   │   ├── logos/           # full, icon, mono, dark, light versions
   │   ├── fonts/           # font files (.ttf, .otf)
   │   ├── frames/          # PNG transparent frames
   │   ├── cards/           # card template PNG
   │   ├── symbols/         # brand icons/symbols
   │   ├── watermarks/      # overlay watermarks
   │   └── palette.json     # colors (hex, rgb, usage)
   └── config.json          # metadata
   ```
2. Create tab in Brands page: "Elements Kit"
3. Asset upload/preview/delete UI per type
4. Auto-extract palette from logos (color-thief library)
5. Generate palette.json from extracted colors
6. Organize by type with drag-drop reordering
7. Preview cards for each asset
8. Export/import elements as bundle

**Test Strategy:**

Test folder structure, UI upload/preview, auto-palette extraction, color accuracy, asset organization, export/import workflow, multiple brand handling.

## Subtasks

### 25.1. Folder Structure Restructure and Migration

**Status:** pending
**Dependencies:** None

Migrate existing brand folders to new structure.

**Details:**

1. Create new folder hierarchy
2. Move knowledge docs to `knowledge/`
3. Move graphics to `elements/`
4. Create `config.json` with brand metadata
5. Create `elements/palette.json` template
6. Update paths in cagent references

### 25.2. Asset Management UI in Brands Tab

**Status:** pending
**Dependencies:** 25.1

Create UI for managing brand elements.

**Details:**

1. New sub-tab "Elements Kit" in Brands
2. Sections by asset type (logos, fonts, frames, etc.)
3. Upload form with drag-drop
4. Preview cards with metadata
5. Delete buttons with confirmation
6. Reorder via drag-drop

### 25.3. Automated Color Palette Extraction

**Status:** pending
**Dependencies:** 25.2

Extract colors from logo images.

**Details:**

1. Install color-thief or similar library
2. Upload logo image
3. Extract dominant colors
4. Generate palette.json
5. Manual adjustment UI
6. Save to Brand Elements Kit

### 25.4. Asset Library Indexing and Search

**Status:** pending
**Dependencies:** 25.2, 25.3

Index elements for quick access during creation.

**Details:**

1. Create element metadata index
2. Search by type, name, color
3. Quick preview on hover
4. Sidebar or floating panel for quick access
5. Cache frequently used elements

### 25.5. Export/Import Bundle Workflow

**Status:** pending
**Dependencies:** 25.1, 25.2, 25.3

Create shareable brand element bundles.

**Details:**

1. Export elements + config as ZIP
2. Import bundle in settings
3. Validation on import
4. Merge with existing elements
5. Version tracking
