# Task ID: 23

**Title:** Integrazione Shotstack Studio SDK + MCP Server

**Status:** pending

**Dependencies:** 5, 7

**Priority:** high

**Description:** Integrate Shotstack Studio SDK (framework-agnostic) into Svelte application for video editing. Configure Shotstack MCP server for Creative Worker agent. Template loading from Brand Elements Kit (logos, fonts, frames, overlays). Implement event bridge from Shotstack to Svelte store. Cloud rendering to video URL with local storage.

**Details:**

1. Install Shotstack Studio: `npm install @shotstack/shotstack-studio`
2. Embed Studio in Svelte via script tag or dynamic import
3. Configure Shotstack API credentials and project
4. Create wrapper component `src/lib/components/video/ShotstackStudio.svelte`
5. Load templates from Brand Elements Kit (frames, overlays, transitions)
6. Implement event bridge: Shotstack events -> Svelte store updates -> agent feedback
7. Handle cloud rendering: submit to Shotstack API -> poll status -> get video URL
8. Integrate with cagent Shotstack MCP for Creative Worker
9. Local video caching and retrieval
10. Error handling for failed renders

**Test Strategy:**

Test Studio embedding, template loading from Brand Elements, event bridge integration, cloud render workflow, local caching, error scenarios.

## Subtasks

### 23.1. Install and Configure Shotstack Studio

**Status:** pending
**Dependencies:** None

Install Shotstack SDK and configure credentials.

**Details:**

1. Install: `npm install @shotstack/shotstack-studio`
2. Configure Shotstack account and API keys
3. Set environment variables in Electron: SHOTSTACK_API_KEY
4. Create configuration wrapper in `src/lib/config/shotstack.ts`

### 23.2. Create Svelte Wrapper Component for Shotstack Studio

**Status:** pending
**Dependencies:** 23.1

Create reusable Svelte component to embed Shotstack Studio.

**Details:**

1. Create `src/lib/components/video/ShotstackStudio.svelte`
2. Dynamic import of Studio library
3. Configuration pass-through from parent
4. Event handlers for changes and renders
5. Error boundary and loading states

### 23.3. Template Loading from Brand Elements Kit

**Status:** pending
**Dependencies:** 23.1, 23.2

Load brand assets (logos, fonts, frames) into Shotstack editor.

**Details:**

1. Read brand elements from `python/brands/{brand-slug}/elements/`
2. Convert PNG frames to Shotstack compositions
3. Upload fonts and color palettes
4. Create template library UI for quick asset access

### 23.4. Event Bridge and State Management

**Status:** pending
**Dependencies:** 23.2, 23.3

Connect Shotstack events to Svelte store and agent feedback.

**Details:**

1. Listen to Shotstack edit events
2. Update `creative-output` store on changes
3. Notify Creative Worker agent of pending renders
4. Track render progress and status

### 23.5. Cloud Rendering and Local Storage

**Status:** pending
**Dependencies:** 23.3, 23.4

Implement cloud rendering workflow with local caching.

**Details:**

1. Create `src/lib/services/shotstack-render.ts`
2. Submit compositions to Shotstack render API
3. Poll render status with exponential backoff
4. Download rendered video to local storage
5. Cache metadata and URLs
6. Fallback error handling
