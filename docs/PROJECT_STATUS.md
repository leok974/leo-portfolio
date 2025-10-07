# Project Status Management

This portfolio includes a project status management system that separates in-progress and completed projects with **interactive filtering on the homepage**.

## Overview

Projects can have two statuses:
- `in-progress` (default) - Active projects shown by default on the homepage
- `completed` - Finished projects accessible via filter or dedicated page

## File Structure

- **projects.json** - Contains project data with `status` and `date_completed` fields
- **completed.html** - Dedicated page for completed projects
- **index.html** - Homepage with dual filter system (status + category)
- **scripts/toggle-status.mjs** - CLI tool for changing project status

## Features

### 🎯 Homepage Dual Filter System

The homepage now includes **two filter bars**:

1. **Status Filter** (top bar with blue accent)
   - **In Progress** - Shows only active projects (default)
   - **Completed** - Shows only finished projects
   - **All** - Shows all projects regardless of status
   - Each button shows count: e.g., "In Progress (2)"

2. **Category Filter** (below status filter)
   - All / AI Agents & Apps / ML Analytics / 3D & Generative Art / DevOps & Security
   - Works in combination with status filter

**How it works:**
- Both filters work together (AND logic)
- Select "Completed" + "AI Agents" = Shows only completed AI agent projects
- Your filter preference is saved in localStorage and restored on page reload

### 📄 Dedicated Completed Page

- Visit `/completed.html` for a curated archive view
- Sorted by completion date (most recent first)
- Shows completion dates on cards

## Usage

### View Projects

#### Homepage with Interactive Filters (`/` or `/index.html`)

**Default View:** Shows in-progress projects only

**Status Filters:**
- Click **"In Progress"** - View active projects (default, saved to localStorage)
- Click **"Completed"** - View finished projects with completion dates
- Click **"All"** - View all projects regardless of status

**Category Filters:** (work in combination with status)
- All / AI Agents & Apps / ML Analytics / 3D & Generative Art / DevOps & Security

**Example workflows:**
- "I want to see what Leo is actively working on" → Default view shows In Progress
- "What has Leo completed in AI?" → Click "Completed" + "AI Agents & Apps"
- "Show me everything" → Click "All" status + "All" categories

**Filter counts:** Each status button shows the number of projects, e.g., "In Progress (2)"

#### Dedicated Completed Page (`/completed.html`)

- Shows **only** completed projects
- Sorted by completion date (most recent first)
- Shows completion dates on each card
- No filters needed - dedicated archive view

### Change Project Status

#### Using NPM scripts (recommended):

```bash
# Mark a project as completed (auto-adds completion date)
npm run proj:complete <slug> completed

# Example: Mark clarity project as completed
npm run proj:complete clarity completed

# Move a project back to in-progress
npm run proj:complete <slug> in-progress

# Example: Move ledgermind back to in-progress
npm run proj:complete ledgermind in-progress
```

#### Using Node directly:

```bash
# Mark as completed
node scripts/toggle-status.mjs clarity completed

# Mark as in-progress
node scripts/toggle-status.mjs clarity in-progress
```

### After Changing Status

Always regenerate project pages after changing status:

```bash
npm run generate-projects
```

This ensures:
- Project pages show the correct status badge
- Status is reflected in project metadata
- Completion dates are properly formatted

## Project Data Format

### In Progress Project

```json
{
  "ledgermind": {
    "title": "LedgerMind",
    "status": "in-progress",
    ...
  }
}
```

### Completed Project

```json
{
  "clarity": {
    "title": "Clarity Companion",
    "status": "completed",
    "date_completed": "2024-09-15",
    ...
  }
}
```

## Key Features

✅ **Dual Filter System** - Status filter (In Progress/Completed/All) + Category filter work together
✅ **Smart Defaults** - Homepage shows In Progress by default, visitors can toggle instantly
✅ **Filter Persistence** - Your status filter choice is saved and restored on page reload
✅ **Real-time Counts** - Each filter button shows count: "In Progress (2)", "Completed (1)", "All (3)"
✅ **Automatic Date Stamping** - Completion date is automatically added when marking as completed
✅ **Sorted Display** - Completed page sorts by most recent completion
✅ **Visual Badges** - Project pages show status badges (✓ Completed / 🚧 In Progress)
✅ **Zero Config** - Projects without status field default to "in-progress"
✅ **Accessible** - Keyboard navigation, ARIA labels, screen reader announcements
✅ **Responsive** - Status filters adapt to mobile screens## Implementation Details

### Dual Filter System (main.js)

The homepage uses **two independent filter bars** that work together:

```javascript
// Status Filter: in-progress | completed | all
let currentStatusFilter = 'in-progress'; // Default

// Category Filter: all | agents | ml | art | devops
let currentCategoryFilter = 'all';

// Apply both filters (AND logic)
function applyFilters() {
  cards.forEach(card => {
    const matchesCategory = (currentCategoryFilter === 'all') || cats.includes(currentCategoryFilter);
    const matchesStatus = (currentStatusFilter === 'all') || (status === currentStatusFilter);
    card.style.display = (matchesCategory && matchesStatus) ? '' : 'none';
  });
}
```

**Filter Counts:**
```javascript
// Count projects by status
const counts = { 'in-progress': 0, 'completed': 0, 'all': 0 };
// Display as: "In Progress (2)"
countSpan.textContent = `(${counts[filter]})`;
```

**Persistence:**
```javascript
// Save preference
localStorage.setItem('projectStatusFilter', currentStatusFilter);
// Restore on page load
const saved = localStorage.getItem('projectStatusFilter');
if (saved) currentStatusFilter = saved;
```

### Completed Page (completed.html)

Fetches all projects, filters for completed status, and sorts by `date_completed`:

```javascript
const completed = all
  .filter(p => (p.status || 'in-progress') === 'completed')
  .sort((a, b) => (b.date_completed || '').localeCompare(a.date_completed || ''));
```

### Generator Integration (generate-projects.js)

Project pages show status badges and completion dates:

```html
<!-- Status badge in tags section -->
<span class="tag">✓ Completed</span>

<!-- Completion date in metadata -->
<time datetime="2024-09-15">Sep 15, 2024</time>
```

## Workflow Example

1. Working on a new project → Set `status: "in-progress"` (or omit field)
2. Project goes live → Keep as `in-progress` to showcase active work
3. Ready to archive → Run `npm run proj:complete <slug> completed`
4. Regenerate pages → Run `npm run generate-projects`
5. Commit and push → Project moves to completed page automatically

## Tips

- **Default Status**: Omit `status` field for new projects (defaults to "in-progress")
- **Completion Date**: Automatically set when marking complete; manually set for historical projects
- **Navigation**: "Completed" link added to main navigation in `index.html`
- **SEO**: Completed projects remain indexed and searchable
- **Archives**: Completed page serves as portfolio archive/timeline

## Troubleshooting

**Q: Project not showing on homepage**
A: Check if `status` is set to `completed`. Run toggle script to fix.

**Q: Completion date missing**
A: Date is only added when using the toggle script. Manually add to `projects.json` if needed.

**Q: Changes not reflecting**
A: Run `npm run generate-projects` to regenerate static pages.

**Q: Need to reorder completed projects**
A: Edit `date_completed` field in `projects.json` to change sort order.
