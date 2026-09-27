# EventSlot Official Brand Style Guide & Color Specification

*Version 1.0 — Official Reference for Design, Marketing & Engineering*  
*Product URL: [www.eventsslot.com](https://www.eventsslot.com)*

---

## 1. Executive Brand Overview

EventSlot's visual identity balances **modern high-tech elegance** with **approachable clarity**. The design system is engineered for exceptional legibility across both Dark Mode (default high-contrast UI) and Light Mode (clean editorial feel).

---

## 2. Primary Brand Colors

These core colors represent the signature identity of EventSlot and should be used for primary interactions, key actions, hero branding, and highlighted components.

```
+-------------------+   +-------------------+   +-------------------+
|  Signature Lime   |   |   Forest Green    |   |   Emerald Green   |
|     #C8F55A       |   |     #15803D       |   |     #22C55E       |
|  (Hero Accent)    |   | (Light Mode CTA)  |   |  (Dark Mode CTA)  |
+-------------------+   +-------------------+   +-------------------+
```

| Swatch | Color Name | HEX | RGB | CSS Token | Primary Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🟢 | **EventSlot Signature Lime** | `#C8F55A` | `rgb(200, 245, 90)` | `--accent-lime` | Hero taglines, glowing badges, accent pills, marketing highlights. |
| 🌲 | **Forest Green** | `#15803D` | `rgb(21, 128, 61)` | `--accent` *(Light)* | Primary Call-to-Action (CTA) buttons, links, and active controls in Light Theme. |
| 🌲 | **Forest Green Hover** | `#166534` | `rgb(22, 101, 52)` | `--accent-hover` *(Light)* | Interactive hover state for Light Theme CTA buttons. |
| 🍃 | **Emerald Green** | `#22C55E` | `rgb(34, 197, 94)` | `--accent` *(Dark)* | Primary Call-to-Action (CTA) buttons and active badges in Dark Theme. |
| 🍃 | **Emerald Green Hover** | `#16A34A` | `rgb(22, 163, 74)` | `--accent-hover` *(Dark)* | Interactive hover state for Dark Theme CTA buttons. |

---

## 3. Dark Theme Palette (Default Web Experience)

The dark theme is built on deep obsidian blacks with layered charcoal cards for high contrast and modern elegance.

| Element / Layer | Color Name | HEX | RGB | CSS Token |
| :--- | :--- | :--- | :--- | :--- |
| **Page Background** | Obsidian Black | `#0A0A0A` | `rgb(10, 10, 10)` | `--bg-page` |
| **Card / Surface Background** | Dark Charcoal | `#141414` | `rgb(20, 20, 20)` | `--bg-surface` |
| **Elevated Surface (Modals / Menus)** | Elevated Charcoal | `#1E1E1E` | `rgb(30, 30, 30)` | `--bg-elevated` |
| **Primary Text (Headings)** | Crisp White | `#FFFFFF` | `rgb(255, 255, 255)` | `--text-primary` |
| **Secondary Text (Subtitles / Body)** | Silver Grey | `#A3A3A3` | `rgb(163, 163, 163)` | `--text-secondary` |
| **Muted Text / Placeholders** | Dim Muted Grey | `#525252` | `rgb(82, 82, 82)` | `--text-muted` |
| **Card Borders & Dividers** | Subtle Border Dark | `#2A2A2A` | `rgb(42, 42, 42)` | `--border` |

---

## 4. Light Theme Palette

The light theme provides a crisp, distraction-free environment for daytime reading and administrative tasks.

| Element / Layer | Color Name | HEX | RGB | CSS Token |
| :--- | :--- | :--- | :--- | :--- |
| **Page Background** | Slate Off-White | `#F8FAFC` | `rgb(248, 250, 252)` | `--bg-page` |
| **Card / Surface Background** | Pure White | `#FFFFFF` | `rgb(255, 255, 255)` | `--bg-surface` |
| **Elevated Surface (Inputs / Modals)** | Light Slate | `#F1F5F9` | `rgb(241, 245, 249)` | `--bg-elevated` |
| **Primary Text (Headings)** | Deep Navy Slate | `#0F172A` | `rgb(15, 23, 42)` | `--text-primary` |
| **Secondary Text (Body / Subtitles)** | Slate Charcoal | `#475569` | `rgb(71, 85, 105)` | `--text-secondary` |
| **Muted Text / Placeholders** | Slate Grey | `#64748B` | `rgb(100, 116, 139)` | `--text-muted` |
| **Card Borders & Dividers** | Border Light | `#E2E8F0` | `rgb(226, 232, 240)` | `--border` |

---

## 5. Semantic & Status Colors

These colors communicate feedback, status alerts, ticket states, and platform notifications.

| State | Purpose | Light Theme HEX | Dark Theme HEX | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | Ticket Confirmed, Check-in Success | `#15803D` | `#22C55E` | Positive outcome / Valid pass |
| **Warning** | Waitlisted, Pending Payment, Low Capacity | `#D97706` | `#F59E0B` | Attention needed / Action pending |
| **Error** | Event Closed, Ticket Already Scanned, Failed | `#DC2626` | `#EF4444` | Invalid action / Gate denial |
| **Info** | Calendar Sync, Notification, Update | `#2563EB` | `#3B82F6` | Helpful guidance / General notice |
| **Gold** | Pioneer Badge, Top Ranking, VIP Tiers | `#D97706` | `#FFD700` | Premium status / Special recognition |

---

## 6. Typography System

| Font Role | Typeface | Fallbacks | Usage |
| :--- | :--- | :--- | :--- |
| **Display / Editorial Headings** | `Instrument Serif` | `Georgia`, `"Times New Roman"`, serif | Event titles, landing page hero headlines, marketing banners. |
| **Body / UI & Data** | `DM Sans` | `ui-sans-serif`, `system-ui`, sans-serif | Navigation, buttons, attendee tables, forms, tickets, dashboards. |

### Hierarchy Guidelines:
- **Hero Title**: `2.5rem - 3.5rem` / `font-serif` (Instrument Serif)
- **Section Heading**: `1.5rem - 1.8rem` / `font-medium`
- **Card Titles & Labels**: `1.0rem - 1.15rem` / `font-semibold`
- **Standard Body Text**: `0.875rem - 0.95rem` / `line-height: 1.6`
- **Micro-labels & Badges**: `0.72rem - 0.78rem` / `letter-spacing: 0.04em` / `font-bold` (Uppercase)

---

## 7. Contrast & Accessibility Rules

1. **Light Mode Text Rule**: Never place bright `#C8F55A` lime text on light backgrounds (`#FFFFFF` or `#F8FAFC`). Use Forest Green (`#15803D`) or Deep Slate (`#0F172A`) for complete WCAG AAA compliance.
2. **Dark Mode Text Rule**: Use `#FFFFFF` for primary text and `#A3A3A3` for secondary text to prevent eye fatigue.
3. **Button Hierarchy**:
   - **Primary Action**: Solid Accent Fill (`#15803D` in Light / `#22C55E` in Dark) with white/dark high-contrast text.
   - **Secondary Action**: Border button (`1px solid var(--border)`) with transparent background and `var(--text-primary)`.
   - **Destructive Action**: Crimson Red (`#DC2626` / `#EF4444`) reserved strictly for permanent deletes or cancellations.
