# Task ID: 27

**Title:** Chat AI Persistente Cross-Tab con Thread Unico

**Status:** pending

**Dependencies:** 5, 19, 11

**Priority:** high

**Description:** Implement persistent AI chat panel at bottom of app with single thread across all tabs. Tab-aware routing to appropriate sub-agent. Support complex commands with hot-reload output. Persistent session history.

**Details:**

1. Create persistent bottom chat panel component
2. Single thread context maintained across all tabs
3. Tab-aware: knows current location (Idea Studio, Creative Output, etc.)
4. Route complex queries to appropriate agent via Orchestrator
5. Support multi-turn conversation
6. Command parsing for complex requests
7. Hot-reload output updates via SSE
8. Session history persistence (localStorage + backend)
9. Context sharing across tabs (localStorage, service workers)
10. Typing indicators and streaming responses
11. Integration with all cagent agents

**Test Strategy:**

Test persistence across tabs, context awareness, agent routing, command parsing, SSE streaming, session history, complex multi-turn conversations, error recovery.

## Subtasks

### 27.1. Bottom Panel Chat Component

**Status:** pending
**Dependencies:** None

Create reusable chat panel UI component.

**Details:**

1. Create `src/lib/components/custom/ChatPanel.svelte`
2. Message list with auto-scroll
3. Input textarea with send button
4. Typing indicator
5. Message timestamps
6. Responsive sizing (collapsible, resizable)
7. Theme support

### 27.2. Persistent State and Session Management

**Status:** pending
**Dependencies:** 27.1

Manage chat state across tabs and sessions.

**Details:**

1. Create `src/lib/stores/chat-session.svelte.ts`
2. Store messages in localStorage
3. Sync across tabs via storage events
4. Load history on app start
5. Session metadata (timestamps, agents used)
6. Clear history functionality

### 27.3. Tab-Aware Context and Agent Routing

**Status:** pending
**Dependencies:** 27.1, 27.2

Route messages to appropriate agents based on tab context.

**Details:**

1. Detect current tab/route
2. Add context metadata to messages
3. Route through Orchestrator agent
4. Orchestrator delegates to sub-agents
5. Context-specific prompting

### 27.4. SSE Streaming and Hot-Reload Output

**Status:** pending
**Dependencies:** 27.3

Implement real-time streaming of agent responses.

**Details:**

1. Create SSE connection for chat responses
2. Stream tokens as they arrive
3. Update message UI incrementally
4. Handle connection reconnection
5. Show source citations
6. Error handling for stream failures

### 27.5. Complex Command Parsing and History

**Status:** pending
**Dependencies:** 27.2, 27.4

Parse complex commands and maintain searchable history.

**Details:**

1. Command parser for slash commands
2. Help system for available commands
3. Search/filter history
4. Export conversation history
5. Command suggestions/autocomplete
