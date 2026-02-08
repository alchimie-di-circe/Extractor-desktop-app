# Task ID: 24

**Title:** Design Compliance Agent (Visual QA Automatico)

**Status:** pending

**Dependencies:** 5, 8, 26

**Priority:** high

**Description:** Implement automated design compliance checking agent for visual QA. Hybrid approach combining programmatic checks (resolution, colors, logo, margins, text) with vision AI for complex cases. Integrates into Creative Output workflow - every output checked BEFORE showing to user.

**Details:**

1. Create new cagent agent: `design-compliance-checker`
2. Layer 1 - Fast programmatic checks:
   - Resolution/format vs. target platform (from platforms.md)
   - Color palette sampling vs. brand palette.json
   - Logo presence and minimum dimensions (bounding box detection)
   - Safe zone margins for text and elements
   - Text spell-check and grammar (multilingual)
3. Layer 2 - Vision AI for complex cases:
   - Logo distortion/damage detection (Gemini Vision)
   - Text overlapping faces/important subjects
   - Overall visual composition and brand coherence
   - Color contrast and readability
4. Report generation: pass/warn/fail for each check
5. Auto-fix attempts for failures with re-verification
6. User-facing warnings with inline suggestions
7. Integration point: Creative Output calls check before showing draft
8. Async queue for batch compliance checks

**Test Strategy:**

Test programmatic checks (resolution, colors, logo detection), vision AI checks (distortion, overlap), report generation, auto-fix attempts, integration in Creative Output flow, batch processing queue.

## Subtasks

### 24.1. Programmatic Checks Layer (Fast)

**Status:** pending
**Dependencies:** None

Implement fast programmatic validation checks.

**Details:**

1. Resolution checker: output format vs. platform specs
2. Color palette sampler: pixel analysis vs. brand palette
3. Logo detector: bounding box, minimum size, presence
4. Safe zone validator: margins, text positioning
5. Grammar/spell check: multilingual dictionary

### 24.2. Vision AI Layer (Slow)

**Status:** pending
**Dependencies:** 24.1

Implement vision AI checks for complex visual issues.

**Details:**

1. Integrate Gemini Vision or Claude Vision
2. Logo distortion detection
3. Text overlap on faces/subjects
4. Composition balance analysis
5. Brand coherence scoring

### 24.3. Report Generation and Remediation

**Status:** pending
**Dependencies:** 24.1, 24.2

Generate compliance reports and attempt auto-fixes.

**Details:**

1. Report schema: check_type, status (pass/warn/fail), message, suggestion
2. Auto-fix attempts for common issues
3. Re-verification after fixes
4. User-facing report with actionable suggestions
5. Export compliance reports

### 24.4. Integration with Creative Output

**Status:** pending
**Dependencies:** 24.1, 24.2, 24.3

Integrate compliance checks into Creative Output tab workflow.

**Details:**

1. Hook compliance check into output generation
2. Show pass/fail status before showing output
3. Display warnings and suggestions inline
4. Block failed outputs with remediation options
5. Track compliance metrics per brand

### 24.5. Batch Queue and Async Processing

**Status:** pending
**Dependencies:** 24.3, 24.4

Implement async queue for batch compliance checks.

**Details:**

1. Redis/memory queue for check jobs
2. Worker process for async checks
3. Progress tracking and status updates via SSE
4. Priority queueing for user-initiated checks
5. Performance monitoring and optimization
