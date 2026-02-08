# Task ID: 10

**Title:** Calendar Widget Scheduling con Postiz Sync

**Status:** pending

**Dependencies:** 1 ✓, 4 ✓, 9

**Priority:** medium

**Description:** Implement calendar-based scheduling interface with month/week/Kanban views for managing social media post scheduling. Removed non-existent @twick/svelte package. Uses FullCalendar or @event-calendar/core (Svelte-compatible). Integrates with Postiz API for bidirectional sync.

**Details:**

1. Install calendar library: `npm install @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction` OR `npm install @event-calendar/core`
2. Remove all Twick references from codebase (CRITICAL: @twick/svelte does not exist)
3. Create `src/routes/scheduling/+page.svelte` with:
   - Calendar component (month view by default)
   - Toggle buttons: Month/Week/Kanban views
   - Drag-drop to reschedule posts between dates
   - Time picker for scheduling specific hours
   - Post preview card on calendar event
4. Create `src/lib/stores/calendar-state.svelte.ts` with Svelte 5 runes:
   - currentView: 'month' | 'week' | 'kanban'
   - scheduledPosts: calendar event data
   - selectedPost: null | ScheduledPost
5. Create `src/lib/services/postiz-sync.ts`:
   - Bidirectional sync with Postiz API
   - Auto-sync on schedule changes
   - Fallback to local state if sync fails
6. Kanban board implementation: columns for days/statuses (draft, scheduled, published)
7. Post status indicators: pending, published, failed
8. Export to calendar file (ical format)

**Test Strategy:**

Test calendar event rendering, drag-drop functionality, Postiz sync with mock API, view toggle, responsive design on mobile/tablet/desktop.

## Subtasks

### 10.1. Installation and Configuration of Calendar Library with Svelte 5

**Status:** pending  
**Dependencies:** None  

Install calendar library and configure with Svelte 5. Test basic calendar rendering and view switching.

**Details:**

1. Choose calendar library: `npm install @event-calendar/core` (recommended, lighter) OR `npm install @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid`
2. Configure calendar styles and localization
3. Create `src/lib/components/calendar/CalendarView.svelte` wrapper component
4. Test rendering month and week views
5. Configure timezone handling and date formatting
6. Set up calendar event structure (title, date, time, metadata)

### 10.2. Create Scheduling Store and Data Models

**Status:** pending  
**Dependencies:** 10.1  

Create Svelte 5 store with calendar state and scheduling data structures.

**Details:**

1. Create `src/lib/stores/calendar-state.svelte.ts`:
   - currentView: 'month' | 'week' | 'kanban'
   - scheduledPosts: ScheduledPost[]
   - selectedPost: ScheduledPost | null
2. Create interfaces:
   - ScheduledPost: id, platform, scheduledAt, content, media[], status
   - CalendarEvent: date, title, postId, status
3. Implement view toggle function
4. Implement post selection and deselection

### 10.3. Drag-and-Drop Scheduling Implementation

**Status:** pending  
**Dependencies:** 10.1, 10.2  

Implement drag-and-drop functionality to reschedule posts between dates with optimistic UI updates.

**Details:**

1. Add drag event handlers to calendar days
2. Create time picker component for precise scheduling
3. Implement visual feedback during drag operations
4. Add smooth animations for event repositioning
5. Create `POST /api/schedule/update` endpoint for persistence
6. Implement optimistic UI with rollback on error

### 10.4. Calendar Views Implementation (Month/Week/Kanban)

**Status:** pending  
**Dependencies:** 10.2, 10.3  

Implement multiple calendar views with toggle button and Kanban board for status-based organization.

**Details:**

1. Month view: full month grid with event indicators
2. Week view: 7-day grid with hour timelines
3. Kanban view: columns for statuses (draft, scheduled, published, failed)
4. Toggle buttons with smooth transitions between views
5. Responsive design for mobile/tablet/desktop viewports

### 10.5. Postiz API Bidirectional Sync

**Status:** pending  
**Dependencies:** 10.2, 10.3, 10.4  

Implement synchronization with Postiz API to sync scheduled posts bidirectionally.

**Details:**

1. Create `src/lib/services/postiz-sync.ts` with:
   - Pull scheduled posts from Postiz API
   - Push new/updated schedules to Postiz
   - Conflict resolution on bidirectional changes
   - Automatic sync on interval and manual trigger
2. Error handling with fallback to local state
3. Queue for offline post scheduling
4. Implement sync status indicator in UI
