# Task ID: 28

**Title:** Integrazione Canva MCP (Opzionale per Power User)

**Status:** pending

**Dependencies:** 5, 23

**Priority:** low

**Description:** Optional Canva MCP integration for power users. Toggle-able alternative to in-app pipeline (Shotstack + Cloudinary). Uses Canva MCP for template generation and asset management. Post-MVP feature.

**Details:**

1. Create settings toggle: "Use Canva for design" (off by default)
2. If enabled: Creative Worker uses Canva MCP for template generation
3. If disabled: Use in-app pipeline (Shotstack + Cloudinary)
4. Canva MCP features:
   - Template search and creation
   - Asset library access
   - Brand kit integration
   - Batch design generation
5. Configure Canva MCP in cagent team.yaml
6. Fallback to in-app pipeline if Canva unavailable
7. API quota management and error handling
8. Post-MVP: defer if time-constrained

**Test Strategy:**

Test Canva MCP integration, toggle functionality, fallback to Shotstack, API quota handling, design quality comparison, brand kit sync, error scenarios.

## Subtasks

### 28.1. Canva MCP Setup and Configuration

**Status:** pending
**Dependencies:** None

Configure Canva MCP in cagent.

**Details:**

1. Install Canva MCP package
2. Configure Canva API credentials
3. Add Canva MCP to cagent team.yaml
4. Test Canva API connectivity
5. Set up API quota monitoring

### 28.2. Settings Toggle and Pipeline Selection

**Status:** pending
**Dependencies:** 28.1

Create UI toggle for Canva vs in-app pipeline.

**Details:**

1. Add toggle in Settings > Creative Tools
2. Save preference to electron-store
3. Pass selection to Creative Worker agent
4. Document Canva feature for users

### 28.3. Canva Template Library Integration

**Status:** pending
**Dependencies:** 28.1, 28.2

Integrate Canva template search and loading.

**Details:**

1. Search Canva template library
2. Load templates based on brand/niche
3. Customize templates with brand elements
4. Save customized templates
5. Template preview and quality scoring

### 28.4. Brand Kit Sync with Canva

**Status:** pending
**Dependencies:** 28.1, 28.2

Sync brand elements with Canva brand kit.

**Details:**

1. Upload brand colors to Canva brand kit
2. Sync logos and fonts
3. Map local elements to Canva equivalents
4. Auto-apply brand kit to templates
5. Bi-directional sync option

### 28.5. Fallback and Error Handling

**Status:** pending
**Dependencies:** 28.1, 28.2, 28.3

Implement fallback to in-app pipeline on Canva failures.

**Details:**

1. Monitor Canva API availability
2. Graceful fallback on quota exceeded
3. Error messaging to user
4. Automatic retry logic
5. Quota usage tracking and warnings
