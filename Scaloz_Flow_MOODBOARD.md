# Scaloz Flow — Complete Design System & Moodboard

> **Source of Truth**: Extracted directly from the active Scaloz Flow codebase (`Frontend/src/index.css`, `Frontend/tailwind.config.js`, `Frontend/index.html`, and React UI components).

---

## 1. Visual Direction & Design Philosophy

Scaloz Flow implements a **high-density, enterprise-grade engineering workspace** marrying the structural clarity of the **Atlassian Jira Design System (ADG)** with bespoke enterprise additions:

* **Header & Shell Archetype**: A signature deep royal navy top navigation bar (`#0B3D91`) paired with a cool grey sidebar surface (`#F4F5F7`), creating an authoritative enterprise frame.
* **Universal 3-Line Header System**: Standardized hierarchy across every dashboard view—a 13px uppercase secondary blue overline, a 30px regular weight title, and a 15px teal/cyan descriptive subtitle.
* **Dual-State System (Light & Dark Mode)**: Explicit dual theme architecture toggled via `data-theme="dark"` and Tailwind `.dark`, shifting from clean paper-like surfaces (`#FFFFFF` / `#F4F5F7`) to deep maritime twilight tones (`#0D1B2A` / `#132341`).
* **High-Density Information Architecture**: 3px–4px border radii for interactive tickets and column headers, 13px–15px compact data tables, 8px layout grid spacing, and strict contrast ratios for rapid scanning during sprint cycles and release milestones.

---

## 2. Typography Extraction & Font Reference

### 2.1 Primary & Fallback Fonts

| Role | Font Family Declaration | Source / Loading Mechanism |
| :--- | :--- | :--- |
| **Primary System Font** | `'Wix Madefor Display'` | Google Fonts `@import url('https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600;700;800&display=swap')` and `<link>` in `index.html` |
| **System Fallback 1** | `-apple-system`, `BlinkMacSystemFont` | Native macOS / iOS system font stack |
| **System Fallback 2** | `'Segoe UI'` | Native Windows Modern UI |
| **System Fallback 3** | `Roboto`, `Helvetica Neue` | Native Android / Linux / ChromeOS |
| **Generic Fallback** | `system-ui`, `sans-serif` | Universal browser default |

> **Global Enforced Rule (`Frontend/src/index.css`)**:
> ```css
> *, *::before, *::after, html, body, #root, button, input, select, textarea, p, span, div, h1, h2, h3, h4, h5, h6, table, th, td {
>   font-family: 'Wix Madefor Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
>   line-height: normal;
>   letter-spacing: normal;
>   font-style: normal;
> }
> ```

---

### 2.2 Font Weights

| Weight Name | Numeric Value | Usage in Scaloz Flow |
| :--- | :--- | :--- |
| **Regular** | `400` | Main page titles (`h1`), card descriptions, rich text body copy, stats card text |
| **Medium** | `500` | Section labels, breadcrumb links, card titles, form field inputs, table cell data |
| **Semibold** | `600` | Global body default, top nav links, Jira action buttons, modal section labels |
| **Bold** | `700` | Form labels, active tabs, dropdown headers, column counts, alert titles |
| **Black / Heavy** | `800` / `900` | KPI numeric metrics, task priority badges, category tags, notification counters |

---

### 2.3 Typography Scale & Component Hierarchy

| UI Role | CSS Selector / Class | Font Size | Weight | Line Height | Letter Spacing | Color (Light / Dark) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Header Overline / Context** | `.section-label`, `.page-label`, `.header-top-text`, `.project-meta`, `.project-breadcrumb` | `13px` (0.8125rem) | 500 (Medium) | Normal | `+0.5px` (Uppercase) | `#1F6FEB` / `#4C9AFF` |
| **Page / Section Main Title** | `.section-title`, `.page-title`, `.dashboard-heading`, `h1` | `30px` (1.875rem) | 400 (Regular) | `1.2` | Normal (`tight`) | `#1F2937` / `#E1E4E8` |
| **Header Subtitle / Description** | `.section-subtitle`, `.page-subtitle`, `.description-text`, `.header-description` | `15px` (0.9375rem) | 400 (Regular) | `1.5` | Normal | `#00B3A4` / `#4C9AFF` |
| **KPI Primary Metric (Large)** | `Dashboard.tsx` stat values | `28px` (1.75rem) | 900 (Black) | `1.1` | `-0.5px` | `#172B4D` / `#EBECF0` |
| **KPI / Metric (Cards)** | `.stats-card *`, `.metric-card *`, `.dashboard-stat *` | `13px` (0.8125rem) | 400 (Regular) | `1.4` | Normal | `#1F2937` / `#EBECF0` |
| **KPI Micro-Label** | `.stats-card p`, `.metric-card span` | `10px` (0.625rem) | 700 (Bold) | Normal | `+0.8px` (Uppercase) | `#6B778C` / `#8993A4` |
| **Board Column Header** | `.kanban-column-header`, `.board-column-header`, `.column-title` | `13px` – `15px` | 500 (Medium) | Normal | `+0.5px` (Uppercase) | `#FFFFFF` (on Blue header) |
| **Kanban Task Card Title** | `TaskCard.tsx h4` | `14px` (0.875rem) | 400 (Regular) | `20px` (1.25) | Normal | `#172B4D` / `#EBECF0` |
| **Task Key Identifier** | `FT-{id}` in Kanban / Table | `12px` (0.75rem) | 500 (Medium) | Normal | `-0.2px` (Uppercase) | `#5E6C84` / `#A5ADBA` |
| **Global Body Default** | `body`, `p`, `span` | `15px` (0.9375rem) | 600 (Semibold) | Normal | Normal | `#172B4D` / `#EBECF0` |
| **Top Navigation Links** | `header button`, `nav-dropdown-container` | `15px` (0.9375rem) | 600 (Semibold) | Normal | Normal | `rgba(255,255,255,0.8)` |
| **Sidebar Navigation Links** | `.sidebar-item`, `.menu-item` | `15px` (0.9375rem) | 600 (Semibold) | Normal | Normal | `#000000` / `#A5ADBA` |
| **Sidebar Section Category** | `.sidebar-node p` | `15px` (0.9375rem) | 700 (Bold) | Normal | Normal | `#000000` / `#8993A4` |
| **Primary Buttons** | `.jira-button-primary`, `.btn` | `14px` (0.875rem) | 600 (Semibold) | Normal | Normal | `#FFFFFF` |
| **Subtle / Ghost Buttons** | `.jira-button-subtle` | `13px` – `14px` | 600 (Semibold) | Normal | Normal | `#42526E` / `#A5ADBA` |
| **Form Labels** | `label` across modals & forms | `12px` – `13px` | 700 (Bold) | Normal | Normal | `#44546F` / `#172B4D` |
| **Form Inputs & Selects** | `input`, `select`, `textarea` | `14px` (text-sm) | 500 (Medium) | Normal | Normal | `#172B4D` / `#EBECF0` |
| **Toast Title** | `Toast.tsx h4` | `12px` (text-xs) | 900 (Black) | Normal | `+0.8px` (Uppercase) | Status Accent Color |
| **Toast Body Message** | `Toast.tsx p` | `12px` (0.75rem) | 500 (Medium) | `1.3` | Normal | `#172B4D` |
| **Table Headers** | `th`, `thead` | `13px` (0.8125rem) | 700 (Bold) | Normal | Normal | `#5E6C84` / `#A5ADBA` |
| **Table Body Cells** | `td`, `tbody tr` | `13px` (0.8125rem) | 400 / 500 | `1.4` | Normal | `#172B4D` / `#EBECF0` |
| **Chart Axis Labels** | SVG `<text>` elements | `10px` – `11px` | 700 (Bold) | Normal | Normal | `#6B778C` / `#8993A4` |
| **Chart Tooltips** | Analytics floating tooltips | `12px` (text-xs) | 600 (Semibold) | Normal | Normal | `#172B4D` |

---

## 3. Color Extraction & Palette Reference

### 3.1 Primary Brand & Shell Colors

```
[████████] #0B3D91  Deep Royal Navy (Header / Brand Anchor)
[████████] #1F6FEB  Secondary Action Blue (Interactive Accent)
[████████] #0052CC  Atlassian Core Blue (Primary Links & Buttons)
[████████] #00B3A4  Accent Teal (Subtitles, Avatars, Brand Identity)
[████████] #4C9AFF  Focus Ring / Sky Blue (Active Focus Borders)
```

| Swatch | Color Name | HEX | RGB | CSS Variable / Token | Usage in UI |
| :---: | :--- | :--- | :--- | :--- | :--- |
| `[ #0B3D91 ]` | **Navy Blue (Top Bar)** | `#0B3D91` | `rgb(11, 61, 145)` | `--brand-header` | Global top navigation bar, active sidebar pill, primary button hover, quick operations widget |
| `[ #1F6FEB ]` | **Secondary Blue** | `#1F6FEB` | `rgb(31, 111, 235)` | `--ds-link-active` | Section overline text, column headers, manage buttons, active tab borders, spinners |
| `[ #0052CC ]` | **Core Brand Blue** | `#0052CC` | `rgb(0, 82, 204)` | `--ds-primary`, `--ds-link` | Primary Jira buttons, markdown hyperlinks, budget settings CTA, table action links |
| `[ #003484 ]` | **Dark Blue Hover** | `#003484` | `rgb(0, 52, 132)` | `--ds-primary-hover` | Button active/pressed states, hover state for `#0052CC` |
| `[ #0747A6 ]` | **Deep Blue Accent** | `#0747A6` | `rgb(7, 71, 166)` | `--color-blue-deep` | High-contrast info text, dark text link states, rich text color grid |
| `[ #4C9AFF ]` | **Focus Ring Blue** | `#4C9AFF` | `rgb(76, 154, 255)` | `--ds-focus-ring` | Input focus rings, input highlight borders, dark mode primary link |
| `[ #DEEBFF ]` | **Soft Blue Tint** | `#DEEBFF` | `rgb(222, 235, 255)` | `--ds-blue-subtle` | Task card badges, unread notification highlights, info pill backgrounds |
| `[ #00B3A4 ]` | **Accent Teal** | `#00B3A4` | `rgb(0, 179, 164)` | `--color-teal-accent` | Page subtitle text, default user avatar fill, workload distribution bars, epic indicators |

---

### 3.2 Neutral Palette & Surface Treatments

```
[████████] #FFFFFF  Canvas White (Light Background)
[████████] #F4F5F7  Atlassian Gray Surface (Sidebar / Card Background)
[████████] #EBECF0  Muted Gray (Hover Surface / Scrollbar Thumb)
[████████] #DFE1E6  Component Border (Cards, Tables, Inputs)
[████████] #172B4D  Deep Navy Text (Primary Body & Headings)
[████████] #42526E  Slate Gray (Subtle Secondary Text)
[████████] #5E6C84  Muted Slate (Metadata, Table Headers)
[████████] #6B778C  Dim Gray (Icons, Timestamp Micro-labels)
```

| Swatch | Color Name | HEX | RGB | CSS Variable / Token | Usage in UI |
| :---: | :--- | :--- | :--- | :--- | :--- |
| `[ #FFFFFF ]` | **Canvas White** | `#FFFFFF` | `rgb(255, 255, 255)` | `--ds-background` | Viewport canvas, modal cards, input surfaces, dropdown containers |
| `[ #FAFBFC ]` | **Off-White Surface** | `#FAFBFC` | `rgb(250, 251, 252)` | `--color-surface-subtle` | Rich text editor toolbar, table header alt rows, disabled input fills |
| `[ #F4F5F7 ]` | **Atlassian Grey** | `#F4F5F7` | `rgb(244, 245, 247)` | `--ds-surface` | Sidebar node background, board column background, card hover states |
| `[ #EBECF0 ]` | **Medium Grey Tint** | `#EBECF0` | `rgb(235, 236, 240)` | `--color-neutral-hover` | Sidebar item hover, drag-over droppable background, progress bar tracks |
| `[ #DFE1E6 ]` | **Standard Border** | `#DFE1E6` | `rgb(223, 225, 230)` | `--ds-border` | All card boundaries, input borders, table borders, top-nav dividing lines |
| `[ #E6E6E6 ]` | **Subtle Divider** | `#E6E6E6` | `rgb(230, 230, 230)` | `--color-border-subtle` | Profile menu dividers, horizontal rules |
| `[ #C1C7D0 ]` | **Scrollbar Thumb** | `#C1C7D0` | `rgb(193, 199, 208)` | `--color-scrollbar-thumb` | Custom webkit scrollbar draggable thumb |
| `[ #A5ADBA ]` | **Scrollbar Hover** | `#A5ADBA` | `rgb(165, 173, 186)` | `--color-scrollbar-hover` | Scrollbar thumb hover state |
| `[ #172B4D ]` | **Primary Body Text** | `#172B4D` | `rgb(23, 43, 77)` | `--ds-text` | Primary text, modal headings, task titles, high-priority numbers |
| `[ #1F2937 ]` | **Dark Header Slate** | `#1F2937` | `rgb(31, 41, 55)` | `--color-slate-900` | Main `h1` titles, stat numbers, dashboard KPI values |
| `[ #42526E ]` | **Secondary Text** | `#42526E` | `rgb(66, 82, 110)` | `--ds-text-subtle` | Subtitles, button labels, chevron icons, modal description text |
| `[ #5E6C84 ]` | **Muted Metadata** | `#5E6C84` | `rgb(94, 108, 132)` | `--color-text-muted` | Task code identifiers (`FT-12`), table column headers, helper text |
| `[ #6B778C ]` | **Dim Icon / Micro** | `#6B778C` | `rgb(107, 119, 140)` | `--color-text-dim` | Card micro-labels, timestamps, close icons, chart axis labels |
| `[ #000000 ]` | **Pure Black** | `#000000` | `rgb(0, 0, 0)` | `--color-black` | Sidebar menu text, section labels in light mode |

---

### 3.3 Status, Severity & Indicator Colors

Scaloz Flow utilizes the Jira 4-tier functional color taxonomy:

```
SUCCESS: [████████] #006644 / #36B37E / #E3FCEF  (Done, On Track, Active Fund)
WARNING: [████████] #854600 / #FF8B00 / #FFF0B3  (In Progress, Medium Priority, At Risk)
DANGER:  [████████] #BF2600 / #DE350B / #FFEBE6  (Overdue, High Priority, Critical, Bug)
INFO:    [████████] #0747A6 / #1F6FEB / #DEEBFF  (Tasks, In Review, Informational Toast)
EPIC:    [████████] #403294 / #6554C0 / #EAE6FF  (Epics, Strategic Goals, Portfolio)
```

| State / Meaning | Text Color | Icon / Accent | Background Tint | Border Tint | Usage in Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Success / Done / On Track** | `#006644` | `#36B37E` | `#E3FCEF` | `#ABF5D1` | Completed tasks, "Done" badges, "On Track" KPI pills, positive budget balance, success toast |
| **Warning / At Risk / In Progress** | `#854600` | `#FF8B00` / `#FFAB00` | `#FFF0B3` | `#FFE380` | Medium priority tasks, "At Risk" KPI status, active sprint zap icons, warning toast |
| **Danger / Critical / Overdue / Bug** | `#BF2600` | `#DE350B` / `#FF5630` | `#FFEBE6` | `#FFBDAD` | High priority tickets, "Critical" anomalies, overdue badges, bug issue icons, error toast |
| **Info / Scheduled / In Review** | `#0747A6` | `#1F6FEB` / `#4C9AFF` | `#DEEBFF` | `#B3D4FF` | Task type badges, unassigned state, notification indicators, info toast |
| **Epic / Strategic Domain** | `#403294` | `#6554C0` | `#EAE6FF` | `#C0B6F2` | Epic cards, epic selector pills, roadmap timeline group bars |
| **Neutral / Backlog / Todo** | `#42526E` | `#5E6C84` | `#F4F5F7` | `#DFE1E6` | Backlog status, unassigned avatars, draft pill states |

---

### 3.4 Issue Type & Priority Color Matrix

| Attribute | Name | Icon Component | Primary Hex | Background Tint Hex | Applied Component |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Issue Type** | **Story** | `<Bookmark />` | `#36B37E` | `#E3FCEF` | Create modal, task cards, backlog items |
| **Issue Type** | **Bug** | `<Bug />` | `#FF5630` | `#FFEBE6` | Defect tracking, burndown anomaly lists |
| **Issue Type** | **Task** | `<CheckSquare />` | `#4C9AFF` | `#DEEBFF` | Standard tasks, subtask checklists |
| **Issue Type** | **Epic** | `<Zap />` | `#6554C0` | `#EAE6FF` | Epic hierarchy, roadmap bars, filters |
| **Priority** | **High** | `<AlertCircle />` | `#DE350B` | `#FFEBE6` | Priority dropdowns, badge pills |
| **Priority** | **Medium** | `<Zap />` | `#FF991F` | `#FFF0B3` | Priority dropdowns, badge pills |
| **Priority** | **Low** | `<CheckCircle2 />` | `#00875A` | `#E3FCEF` | Priority dropdowns, badge pills |

---

### 3.5 Chart, Graph & Analytics Engine Palette

Extracted directly from SVG rendering pipelines (`Insights.tsx`, `CumulativeFlowIntelligenceTab.tsx`, `VelocityAnalyticsTab.tsx`):

```
BURNDOWN / VELOCITY
[████████] #1F6FEB  Committed Scope / Target Line
[████████] #10B981  Actual Completion Line & Points
[████████] #FF5630  Scope Creep / Today Guideline
[████████] #F59E0B  Rolling Velocity Average

CUMULATIVE FLOW DIAGRAM (CFD)
[████████] #F59E0B  To Do Area Layer (Gradient to #FBBF24)
[████████] #2563EB  WIP / In Progress Area (Gradient to #3B82F6)
[████████] #059669  Done Cumulative Area (Gradient to #10B981)

CHART INFRASTRUCTURE
[████████] #E2E8F0  Horizontal Dashed Grid Lines
[████████] #CBD5E1  Axis Lines & Baseline Ticks
[████████] #F1F5F9  Donut Chart Background Track
```

| Element | HEX Value | RGB Value | Visual Role |
| :--- | :--- | :--- | :--- |
| **CFD "To Do" Boundary & Fill** | `#F59E0B` | `rgb(245, 158, 11)` | Dashed boundary line, gradient stop (`#F59E0B` to `#FBBF24`) |
| **CFD "WIP" Boundary & Fill** | `#2563EB` | `rgb(37, 99, 235)` | Solid line with glow, gradient stop (`#3B82F6` to `#60A5FA`) |
| **CFD "Done" Boundary & Fill** | `#059669` | `rgb(5, 150, 105)` | Solid line with glow, gradient stop (`#10B981` to `#34D399`) |
| **Burndown Ideal Target Line** | `#1F6FEB` | `rgb(31, 111, 235)` | 2.5px solid curve with circular anchor points |
| **Burndown Actual Done Line** | `#10B981` | `rgb(16, 185, 129)` | 2.5px solid curve with circular anchor points |
| **Burndown Current Day Marker**| `#FF5630` | `rgb(255, 86, 48)` | Vertical dashed guide line (`strokeDasharray="4,4"`) |
| **Chart Axis Line** | `#CBD5E1` | `rgb(203, 213, 225)` | 1.5px baseline on x-axis and y-axis ticks |
| **Chart Grid Line** | `#E2E8F0` | `rgb(226, 232, 240)` | 1px horizontal grid line (`strokeDasharray="3,3"`) |
| **Donut Empty Ring** | `#F1F5F9` / `#F4F5F7` | `rgb(241, 245, 249)` | Base track ring (`strokeWidth="11"`) |

---

### 3.6 Comprehensive Dark Mode Color System

When `[data-theme='dark']` is active on `<html>`:

```
LIGHT MODE                DARK MODE EQUIVALENT
[████████] #FFFFFF  --->  [████████] #0D1B2A  Deep Obsidian Canvas
[████████] #F4F5F7  --->  [████████] #132341  Navy Twilight Card Surface
[████████] #DFE1E6  --->  [████████] #1C2D41  Muted Slate Card Border
[████████] #172B4D  --->  [████████] #EBECF0  High-Contrast Light Text
[████████] #42526E  --->  [████████] #A5ADBA  Subtle Muted Text
[████████] #5E6C84  --->  [████████] #8993A4  Dim Metadata Text
[████████] #1F6FEB  --->  [████████] #4C9AFF  Luminous Blue Links
```

| Light Token | Light HEX | Dark Mode HEX | Dark Mode Semantic Token |
| :--- | :--- | :--- | :--- |
| `--ds-background` | `#FFFFFF` | `#0D1B2A` | Deep Obsidian Navy Canvas |
| `--ds-surface` | `#F4F5F7` | `#132341` | Elevated Twilight Card Surface |
| `--ds-border` | `#DFE1E6` | `#1C2D41` | Low-Glare Midnight Border |
| `--ds-text` | `#172B4D` | `#EBECF0` | High-Legibility Off-White |
| `--ds-text-subtle` | `#42526E` | `#A5ADBA` | Medium-Contrast Secondary |
| `--ds-text-muted` | `#5E6C84` | `#8993A4` | Low-Contrast Metadata |
| `--ds-primary` | `#0052CC` | `#4C9AFF` | High-Visibility Cyan-Blue |
| `--ds-link` | `#0052CC` | `#4C9AFF` | Underlined Interactive Link |
| `bg-[#DEEBFF]` | `#DEEBFF` | `rgba(76, 154, 255, 0.15)` | Soft Blue Pill Tint |
| `bg-[#E3FCEF]` | `#E3FCEF` | `rgba(54, 179, 126, 0.15)` | Soft Green Pill Tint |
| `bg-[#FFF0B3]` | `#FFF0B3` | `rgba(255, 139, 0, 0.15)` | Soft Amber Pill Tint |
| `bg-[#FFEBE6]` | `#FFEBE6` | `rgba(191, 38, 0, 0.15)` | Soft Red Pill Tint |
| `bg-[#EAE6FF]` | `#EAE6FF` | `rgba(101, 84, 192, 0.15)` | Soft Purple Pill Tint |
| `bg-[#E6FCFF]` | `#E6FCFF` | `rgba(0, 163, 191, 0.15)` | Soft Teal Pill Tint |
| `.custom-scrollbar-thumb` | `#C1C7D0` | `#2C3E50` | Dark Mode Scrollbar Handle |

---

## 4. Surfaces, Borders, Shadows & Treatment Tokens

### 4.1 Corner Radius Standards

| Token Name | Radius Value | Applied Components |
| :--- | :--- | :--- |
| `rounded-[2px]` | `2px` | Micro-tags, tag badges, task key icons |
| `rounded-[3px]` | `3px` | **Core Atlassian standard**: Jira buttons, card boundaries, form inputs, dropdown selectors |
| `rounded-[4px]` | `4px` | Kanban column wrappers, column headers, modal utility containers |
| `rounded-[6px]` | `6px` | Navigation links, quick filter pill buttons |
| `rounded-[8px]` | `8px` | **Scaloz standard**: Dashboard stats cards, metric tiles, sidebar active pills, modal dialog shells |
| `rounded-full` | `9999px` | User profile avatars, notification counters, circular action toggles, status pills |

---

### 4.2 Elevation & Shadow Reference

| Shadow Token | CSS Definition | Purpose & Component Usage |
| :--- | :--- | :--- |
| `shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | Standard card elevation, metric tiles, dropdown buttons |
| `shadow-card` | `0 1px 1px rgba(9, 30, 66, 0.25)` | Kanban draggable card default elevation |
| `shadow-dragging`| `0 10px 20px -5px rgba(9, 30, 66, 0.25)` | Kanban card while being dragged across columns |
| `shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1)` | Hover state for metric cards, floating action buttons |
| `shadow-premium` | `0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.03)` | Tailwind token for executive summaries & dashboards |
| `shadow-glass` | `0 8px 32px 0 rgba(31, 38, 135, 0.07)` | Tailwind token for floating panels & preview overlays |
| `shadow-2xl` | `0 25px 50px -12px rgba(0, 0, 0, 0.25)` | Modal dialogs, large dropdown popovers, search results |

---

### 4.3 Gradients & Overlays

| Name | CSS Value | UI Application |
| :--- | :--- | :--- |
| `login-gradient` | `radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.15) 0%, rgba(2, 6, 23, 1) 40%)` | Auth / Login screen backdrop |
| `cfdDoneGradient` | `linear-gradient(180deg, rgba(16, 185, 129, 0.35) 0%, rgba(52, 211, 153, 0.06) 100%)` | Cumulative Flow Diagram Done area |
| `cfdWipGradient` | `linear-gradient(180deg, rgba(59, 130, 246, 0.35) 0%, rgba(96, 165, 250, 0.06) 100%)` | Cumulative Flow Diagram WIP area |
| `cfdTodoGradient`| `linear-gradient(180deg, rgba(245, 158, 11, 0.30) 0%, rgba(251, 191, 36, 0.04) 100%)` | Cumulative Flow Diagram To Do area |
| `modal-backdrop` | `rgba(9, 30, 66, 0.20)` / `rgba(0, 0, 0, 0.50)` with `backdrop-blur-sm` | Create Issue Modal, Task Detail Modal |
| `lightbox-dark` | `rgba(0, 0, 0, 0.90)` with `backdrop-blur-sm` | Fullscreen attachment and image preview lightbox |

---

## 5. Source Code Inspection & Declarations Analysis

### 5.1 Active Declarations (Source of Truth)
1. **Font Declaration**: `Frontend/index.html` loads `Wix Madefor Display` (weights 400–800) and `Frontend/src/index.css` strictly enforces it with `!important` across all tags.
2. **Top Navigation Color**: Hardcoded `#0B3D91` in `DashboardLayout.tsx` and overridden in `index.css`.
3. **Typography 3-Line Header**: Enforced via `.section-label` (`13px`, `#1F6FEB`), `.section-title` (`30px`, `#1F2937`), `.section-subtitle` (`15px`, `#00B3A4`).
4. **Dark Mode Engine**: Managed by `Frontend/src/context/ThemeContext.tsx` toggling `data-theme="dark"` on `<html>`, with 420+ lines of explicit CSS overrides in `Frontend/src/index.css`.

### 5.2 Conflicting & Unused Declarations (Dead Code Warning)
1. **`Frontend/src/App.css` (Unused Vite Starter)**:
   - Contains rules like `.counter`, `.hero`, `.framework`, `#next-steps`, and custom properties `--accent`, `--social-bg`, `--text-h`.
   - **Status**: **Completely Unused**. Neither `main.tsx` nor `App.tsx` imports `App.css`.
2. **Bootstrap 5.3.2 Import in `Frontend/index.html`**:
   - Imports Bootstrap 5.3.2 CSS via jsDelivr CDN.
   - **Conflict**: Bootstrap sets standard system fonts and large button radii. `Frontend/src/index.css` explicitly neutralizes Bootstrap via `* { font-family: 'Wix Madefor Display' !important; }` and `.btn { border-radius: 3px; font-weight: 500; font-size: 14px; }`.
3. **`stats-card` Specificity Battle**:
   - `Frontend/src/pages/Dashboard.tsx` sets `h2` with `text-[28px] font-black text-[#172B4D]`.
   - `Frontend/src/index.css` lines 480–500 contains `.stats-card h1, .stats-card h2 { font-size: 13px !important; font-weight: 400 !important; }` designed to normalize dense metric grids.
   - **Reality**: In pages importing `.stats-card`, the CSS `!important` overrides Tailwind utility classes unless inline styles are supplied.

---

## 6. Recommended Reusable CSS Variables System

To maintain design integrity and streamline future component development, the following complete set of CSS custom properties reflects the extracted tokens:

```css
:root {
  /* ==========================================================================
     SCALOZ FLOW DESIGN TOKENS (LIGHT THEME)
     ========================================================================== */

  /* Typography */
  --font-family-sans: 'Wix Madefor Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-2xs: 10px;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 15px;
  --font-size-xl: 18px;
  --font-size-2xl: 24px;
  --font-size-3xl: 28px;
  --font-size-4xl: 30px;

  /* Brand Primitives */
  --color-brand-navy: #0B3D91;          /* Top Navigation & Core Branding */
  --color-brand-blue-action: #1F6FEB;   /* Action Blue, Headers & Spinners */
  --color-brand-blue-jira: #0052CC;     /* Primary Buttons & Hyperlinks */
  --color-brand-blue-hover: #003484;    /* Pressed / Hover Primary Blue */
  --color-brand-blue-focus: #4C9AFF;    /* Focus Rings & Selection Borders */
  --color-brand-blue-tint: #DEEBFF;     /* Blue Pill Backgrounds */
  --color-brand-teal: #00B3A4;          /* Subtitles, User Avatars, Accents */

  /* Neutrals & Surfaces */
  --color-canvas-white: #FFFFFF;        /* Viewport Canvas & Card Background */
  --color-surface-subtle: #FAFBFC;      /* Toolbars & Alt Rows */
  --color-surface-grey: #F4F5F7;        /* Sidebar & Column Containers */
  --color-surface-muted: #EBECF0;       /* Card Hover & Progress Track */
  --color-border-standard: #DFE1E6;     /* Card, Input & Table Borders */
  --color-border-subtle: #E6E6E6;       /* Section Dividers */

  /* Text & Typography Colors */
  --color-text-primary: #172B4D;       /* Body Text & High-Priority Titles */
  --color-text-heading: #1F2937;       /* Section Titles & Metric Numbers */
  --color-text-subtle: #42526E;        /* Secondary Descriptions & Buttons */
  --color-text-muted: #5E6C84;         /* Metadata, Task Keys, Column Th */
  --color-text-dim: #6B778C;           /* Timestamps, Card Micro-Labels */

  /* Functional Status - Success */
  --color-success-text: #006644;
  --color-success-icon: #36B37E;
  --color-success-surface: #E3FCEF;
  --color-success-border: #ABF5D1;

  /* Functional Status - Warning */
  --color-warning-text: #854600;
  --color-warning-icon: #FF8B00;
  --color-warning-surface: #FFF0B3;
  --color-warning-border: #FFE380;

  /* Functional Status - Danger */
  --color-danger-text: #BF2600;
  --color-danger-icon: #DE350B;
  --color-danger-surface: #FFEBE6;
  --color-danger-border: #FFBDAD;

  /* Functional Status - Epic / Purple */
  --color-epic-text: #403294;
  --color-epic-icon: #6554C0;
  --color-epic-surface: #EAE6FF;
  --color-epic-border: #C0B6F2;

  /* Layout Dimensions */
  --header-height: 48px;
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 20px;

  /* Radius Tokens */
  --radius-xs: 2px;
  --radius-sm: 3px;                     /* Jira standard */
  --radius-md: 4px;
  --radius-lg: 8px;                     /* Scaloz dashboard cards */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 1px 1px rgba(9, 30, 66, 0.25);
  --shadow-card-dragging: 0 10px 20px -5px rgba(9, 30, 66, 0.25);
  --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.1);
  --shadow-modal: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* ==========================================================================
   SCALOZ FLOW DESIGN TOKENS (DARK THEME OVERRIDES)
   ========================================================================== */
[data-theme='dark'] {
  --color-canvas-white: #0D1B2A;        /* Deep Obsidian Canvas */
  --color-surface-subtle: #0D1B2A;
  --color-surface-grey: #132341;        /* Navy Twilight Cards */
  --color-surface-muted: #1C2D41;
  --color-border-standard: #1C2D41;     /* Midnight Low-Glare Borders */
  --color-border-subtle: #1C2D41;

  --color-text-primary: #EBECF0;
  --color-text-heading: #E1E4E8;
  --color-text-subtle: #A5ADBA;
  --color-text-muted: #8993A4;
  --color-text-dim: #8993A4;

  --color-brand-blue-action: #4C9AFF;
  --color-brand-blue-jira: #4C9AFF;

  --color-success-surface: rgba(54, 179, 126, 0.15);
  --color-warning-surface: rgba(255, 139, 0, 0.15);
  --color-danger-surface: rgba(191, 38, 0, 0.15);
  --color-epic-surface: rgba(101, 84, 192, 0.15);
  --color-brand-blue-tint: rgba(76, 154, 255, 0.15);
}
```

---

## 7. Executive Summary & Implementation Takeaways

1. **Identity & Heritage**: Scaloz Flow is built upon the time-tested **Atlassian Jira design language** (`#0052CC`, `#DFE1E6`, `#172B4D`, 3px border-radius buttons, and 5-state colored badge taxonomy), augmented with Scaloz enterprise brand markers: **Deep Navy `#0B3D91`**, **Action Blue `#1F6FEB`**, and **Accent Mint/Teal `#00B3A4`**.
2. **Typography Consistency**: One font to rule them all: `'Wix Madefor Display'` is loaded via CDN and aggressively enforced across every element, avoiding arbitrary system font mismatches.
3. **Predictable Component Visual Grammar**:
   - **Actions & CTAs**: Always `#0052CC` or `#1F6FEB` with `#FFFFFF` text.
   - **Borders**: Always `#DFE1E6` (light) and `#1C2D41` (dark).
   - **Surfaces**: Canvas is `#FFFFFF` / `#0D1B2A`, secondary cards are `#F4F5F7` / `#132341`.
   - **Header Subtext**: Always `#00B3A4` (Mint) in light mode and `#4C9AFF` (Sky) in dark mode.
4. **Zero-Guesswork Handoff**: All HEX values, RGB values, and font metrics documented above represent exact production values running in Scaloz Flow.
