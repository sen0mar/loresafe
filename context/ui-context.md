# UI Context

## Visual Reference

Primary reference image:

- `context/images/dashboard/threadsync-dashboard-dark-reference.png`

Use it for visual direction only. The app name in the UI should be **ThreadSync**, not the older reference name.

Visual language: dark, compact, glassy panels with thin borders, cyan brand accents, progress-aware cards, calm metadata, and clear locked/safe states.

## Theme Rules

- MVP is dark-mode first. Do not invent a light theme unless requested.
- Define colors as CSS custom properties and map them to Tailwind semantic tokens.
- Components must use semantic utilities such as `bg-base`, `bg-surface`, `border-default`, `text-primary`, `text-muted`, `bg-brand`, `text-brand`, and `ring-brand`.
- Do not hardcode hex colors or raw Tailwind palette colors inside feature components.
- shadcn/ui components should be mapped to these tokens rather than styled ad hoc per feature.

## Dark Tokens

Colors below were sampled from the uploaded dashboard reference.

| Role | CSS variable | HEX / value |
| --- | --- | --- |
| Page background | `--bg-base` | `#0c141b` |
| Deep background | `--bg-base-deep` | `#040e16` |
| Surface | `--bg-surface` | `#111920` |
| Elevated surface | `--bg-elevated` | `#121a21` |
| Subtle surface/card | `--bg-subtle` | `#131b22` |
| Input/inset surface | `--bg-inset` | `#10181f` |
| Active nav/selected surface | `--bg-active` | `#0f2129` |
| Overlay | `--bg-overlay` | `rgba(4, 14, 22, 0.72)` |
| Background pattern | `--bg-pattern` | `rgba(33, 54, 60, 0.32)` |
| Default border | `--border-default` | `#1e252c` |
| Subtle border/divider | `--border-subtle` | `#20292f` |
| Strong/accent border | `--border-strong` | `#2e4c54` |
| Brand border | `--border-brand` | `#138997` |
| Primary text | `--text-primary` | `#f9fbfb` |
| Secondary text | `--text-secondary` | `#e4e7e9` |
| Muted text | `--text-muted` | `#bfc0c0` |
| Faint text | `--text-faint` | `#878d92` |
| Disabled text | `--text-disabled` | `#51595d` |
| Brand accent | `--accent-primary` | `#138997` |
| Brand hover | `--accent-primary-hover` | `#17afb7` |
| Brand active | `--accent-primary-active` | `#0c818c` |
| Brand bright | `--accent-primary-bright` | `#45c5d3` |
| Brand text on dark | `--accent-primary-text` | `#8fd2d6` |
| Text on brand button | `--accent-on-primary` | `#e9fbfb` |
| Brand soft background | `--accent-primary-soft` | `#0f2129` |
| Brand dim background | `--accent-primary-dim` | `#14575c` |
| Brand glow | `--accent-primary-glow` | `rgba(69, 197, 211, 0.35)` |
| Secondary blue | `--accent-secondary` | `#4489f4` |
| Success/read | `--state-success` | `#4be05a` |
| Warning/brave | `--state-warning` | `#f49322` |
| Error/destructive | `--state-error` | `#ef4444` |
| Info/locked | `--state-info` | `#4489f4` |
| Purple/stat accent | `--state-purple` | `#c396d9` |
| Hot/popular accent | `--state-hot` | `#fd760d` |
| Chart read | `--chart-read` | `#4be05a` |
| Chart locked | `--chart-locked` | `#4489f4` |
| Chart available | `--chart-available` | `#bfc0c0` |
| Chart future | `--chart-future` | `#676a6e` |
| Card shadow | `--shadow-card` | `0 18px 50px rgba(0, 0, 0, 0.28)` |
| Soft shadow | `--shadow-soft` | `0 10px 30px rgba(0, 0, 0, 0.22)` |
| Brand glow shadow | `--shadow-glow` | `0 0 24px rgba(69, 197, 211, 0.24)` |
| Primary gradient | `--gradient-primary` | `linear-gradient(135deg, #17afb7 0%, #138997 100%)` |
| App background gradient | `--gradient-app` | `radial-gradient(circle at 70% 0%, rgba(19, 137, 151, 0.12), transparent 34%), #0c141b` |

Recommended CSS starting point:

```css
:root {
  color-scheme: dark;
  --bg-base: #0c141b;
  --bg-base-deep: #040e16;
  --bg-surface: #111920;
  --bg-elevated: #121a21;
  --bg-subtle: #131b22;
  --bg-inset: #10181f;
  --bg-active: #0f2129;
  --border-default: #1e252c;
  --border-subtle: #20292f;
  --border-strong: #2e4c54;
  --accent-primary: #138997;
  --accent-primary-hover: #17afb7;
  --accent-primary-active: #0c818c;
  --accent-primary-bright: #45c5d3;
  --text-primary: #f9fbfb;
  --text-secondary: #e4e7e9;
  --text-muted: #bfc0c0;
  --text-faint: #878d92;
}
```

## shadcn/ui Token Mapping

Map shadcn primitives to the semantic ThreadSync tokens:

- `background` → `--bg-base`
- `foreground` → `--text-primary`
- `card` / `popover` → `--bg-surface`
- `muted` → `--bg-inset`
- `muted-foreground` → `--text-faint`
- `primary` → `--accent-primary`
- `primary-foreground` → `--accent-on-primary`
- `secondary` → `--bg-active`
- `border` / `input` → `--border-default`
- `ring` → `--accent-primary-bright`
- `destructive` → `--state-error`

## Token Usage

- Primary CTAs use `--gradient-primary` or `--accent-primary`.
- Selected navigation, selected filters, selected reading mode, and soft badges use `--bg-active` with brand border/text.
- Cards use `--bg-elevated` or `--bg-subtle` with `--border-default`.
- Inputs use `--bg-inset` with `--border-subtle`.
- Metadata uses `--text-faint`; descriptions use `--text-muted`; titles use `--text-primary`.
- Locked placeholders use muted text, safe metadata only, and an obvious lock icon.
- Charts and progress dots use chart tokens, not arbitrary colors.

## Typography

- UI font: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Mono font: `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- Titles are medium/semibold, not overly bold.
- Metadata should be small and calm, usually 12–14px.
- Avoid long uppercase labels except small section headers.

## Radius and Borders

| Context | Recommended class |
| --- | --- |
| Inputs, filters, badges | `rounded-md` |
| Buttons and compact cards | `rounded-lg` |
| Cards and panels | `rounded-xl` |
| App shell / large panels | `rounded-2xl` |
| Modal / overlay | `rounded-2xl` |
| Avatars | `rounded-full` |
| Icon wells | `rounded-lg` |

Use 1px borders for most panels. Use brand borders sparingly for active/selected states.

## Layout Patterns

### Primary App Shell

- Desktop uses a three-column app shell:
  - left sidebar: about `252px` fixed.
  - main content: flexible, min width protected.
  - right sidebar: about `320px` fixed.
- Main content has top search/header, club header, tabs, filters, feed cards, and lower summary panels.
- Right sidebar contains quick progress update, reading mode, stats, and contextual panels.
- Bottom panels can use a 3-column grid on wide screens.
- On mobile/tablet, collapse left navigation and right sidebar into drawers or route-level panels.

### Cards and Panels

- Use thin borders, subtle shadows, and consistent padding.
- Feed cards should have metadata row, title/content preview, reactions/actions, and optional mode badge.
- Locked cards should center the lock state and show only safe unlock requirements.
- Avoid cramming unrelated actions into a single card.

### Progress UI

- Progress bars use the brand cyan token.
- Read/completed dots use success green.
- Locked/future dots use blue/gray tokens.
- Never reveal future milestone names when the milestone name itself is unsafe.

## Spacing and Density

- App shell padding: `p-2` to `p-4` depending on viewport.
- Main content padding: `px-6 py-4` on desktop.
- Card padding: `p-4` for feed cards and side panels.
- Compact controls: height `32–40px`.
- Common gaps: `gap-3` and `gap-4`.
- Keep the dashboard dense, but preserve readable line height and touch targets.

## Buttons and Interactions

- Primary button: cyan gradient, white/cyan-tinted text, subtle glow on hover.
- Secondary button: dark surface, thin border, muted text, brighter border/text on hover.
- Ghost button: transparent with hover surface.
- Active nav item: `--bg-active`, brand icon/text, subtle border/glow.
- Focus ring: 2px brand bright ring with offset against dark surfaces.
- Transitions: `150ms ease-out` for hover/focus; avoid heavy motion.

## Icons

Icon library: lucide-react.

| Context | Size |
| --- | --- |
| Inline text icons | `14px` |
| Buttons/nav | `18px` |
| Panel/card icons | `20px` |
| Empty states | `32px` |

Use stroke icons consistently. Avoid mixing emoji, 3D icons, and filled icon sets in core UI.

## Accessibility

- Every interactive element needs hover, focus-visible, disabled, and loading states.
- Badges must include text, not only color.
- Modals and drawers need keyboard focus management.
- Maintain contrast for cyan text on dark backgrounds.
- Do not rely on color alone to communicate Strict/Soft/Brave/Finished or locked/unlocked states.
