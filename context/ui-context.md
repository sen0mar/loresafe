# UI Context

## Visual Reference

Primary reference image:

- `context/images/dashboard/threadsync-dashboard-dark-reference.png`

Use it for visual direction only. The app name in the UI should be **ThreadSync**, not the older reference name.

Visual language: dark, compact, flat panels with thin borders, steel-blue brand accents, progress-aware cards, calm metadata, and clear locked/safe states.

## Theme Rules

- MVP is dark-mode first. Do not invent a light theme unless requested.
- Define colors as CSS custom properties and map them to Tailwind semantic tokens.
- Components must use semantic utilities such as `bg-base`, `bg-surface`, `border-default`, `text-primary`, `text-muted`, `bg-brand`, `text-brand`, and `ring-brand`.
- Do not hardcode hex colors or raw Tailwind palette colors inside feature components.
- shadcn/ui components should be mapped to these tokens rather than styled ad hoc per feature.

## Dark Tokens

Colors below define the current app palette in `apps/web/src/styles.css`.

| Role | CSS variable | HEX / value |
| --- | --- | --- |
| Page background | `--bg-base` | `#07090c` |
| Deep background | `--bg-base-deep` | `#000000` |
| Surface | `--bg-surface` | `#090b0e` |
| Elevated surface | `--bg-elevated` | `#0e1116` |
| Subtle surface/card | `--bg-subtle` | `#12161c` |
| Input/inset surface | `--bg-inset` | `#06080b` |
| Active nav/selected surface | `--bg-active` | `#101a27` |
| Overlay | `--bg-overlay` | `rgba(0, 0, 0, 0.78)` |
| Background pattern | `--bg-pattern` | `rgba(96, 145, 214, 0.09)` |
| Default border | `--border-default` | `#1a2028` |
| Subtle border/divider | `--border-subtle` | `#131820` |
| Strong/accent border | `--border-strong` | `#334055` |
| Brand border | `--border-brand` | `#6091d6` |
| Primary text | `--text-primary` | `#f6f7f4` |
| Secondary text | `--text-secondary` | `#d9ded8` |
| Muted text | `--text-muted` | `#a8b0aa` |
| Faint text | `--text-faint` | `#717a78` |
| Disabled text | `--text-disabled` | `#424947` |
| Brand accent | `--accent-primary` | `#6091d6` |
| Brand hover | `--accent-primary-hover` | `#7ba9e7` |
| Brand active | `--accent-primary-active` | `#4f7fc0` |
| Brand bright | `--accent-primary-bright` | `#aacbfa` |
| Brand text on dark | `--accent-primary-text` | `#b9d5fb` |
| Text on brand button | `--accent-on-primary` | `#07101d` |
| Brand soft background | `--accent-primary-soft` | `#101a27` |
| Brand dim background | `--accent-primary-dim` | `#2d4a72` |
| Brand glow | `--accent-primary-glow` | `rgba(96, 145, 214, 0.18)` |
| Secondary accent | `--accent-secondary` | `#b88eea` |
| Success/read | `--state-success` | `#91add4` |
| Warning/brave | `--state-warning` | `#f4bd61` |
| Error/destructive | `--state-error` | `#ff6b73` |
| Info/locked | `--state-info` | `#82a9e7` |
| Purple/stat accent | `--state-purple` | `#caa8ff` |
| Hot/popular accent | `--state-hot` | `#ff9364` |
| Chart read | `--chart-read` | `#91add4` |
| Chart locked | `--chart-locked` | `#82a9e7` |
| Chart available | `--chart-available` | `#a8b0aa` |
| Chart future | `--chart-future` | `#535b5a` |
| Card shadow | `--shadow-card` | `none` |
| Soft shadow | `--shadow-soft` | `none` |
| Brand glow shadow | `--shadow-glow` | `none` |
| Primary gradient | `--gradient-primary` | `linear-gradient(135deg, #7ba9e7 0%, #6091d6 100%)` |
| App background | `--gradient-app` | `#07090c` |

Recommended CSS starting point:

```css
:root {
  color-scheme: dark;
  --bg-base: #07090c;
  --bg-base-deep: #000000;
  --bg-surface: #090b0e;
  --bg-elevated: #0e1116;
  --bg-subtle: #12161c;
  --bg-inset: #06080b;
  --bg-active: #101a27;
  --border-default: #1a2028;
  --border-subtle: #131820;
  --border-strong: #334055;
  --accent-primary: #6091d6;
  --accent-primary-hover: #7ba9e7;
  --accent-primary-active: #4f7fc0;
  --accent-primary-bright: #aacbfa;
  --text-primary: #f6f7f4;
  --text-secondary: #d9ded8;
  --text-muted: #a8b0aa;
  --text-faint: #717a78;
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
- Selected navigation, selected filters, selected reading mode, and subtle badges use `--bg-active` with brand border/text.
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

ThreadSync uses a softer, more circular radius scale from `apps/web/src/styles.css`
with `--radius: 1.125rem`.

| Context | Recommended class |
| --- | --- |
| Inputs, filters, badges | `rounded-md` |
| Buttons and compact cards | `rounded-lg` |
| Cards and panels | `rounded-xl` |
| App shell / large panels | `rounded-2xl` |
| Modal / overlay | `rounded-2xl` |
| Avatars | `rounded-full` |
| Icon wells | `rounded-lg` |

Current semantic radius values are approximately: `rounded-md` 16px, `rounded-lg`
18px, `rounded-xl` 22px, and `rounded-2xl` 26px. Prefer these shared classes
over arbitrary radius values so the app keeps a consistently rounded feel.

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

- Use thin borders, flat surfaces, and consistent padding.
- Feed cards should have metadata row, title/content preview, reactions/actions, and optional mode badge.
- Locked cards should center the lock state and show only safe unlock requirements.
- Avoid cramming unrelated actions into a single card.

### Progress UI

- Progress bars use the brand steel-blue token.
- Read/completed dots use the success/read token.
- Locked/future dots use info/gray tokens.
- Never reveal future milestone names when the milestone name itself is unsafe.

## Spacing and Density

- App shell padding: `p-2` to `p-4` depending on viewport.
- Main content padding: `px-6 py-4` on desktop.
- Card padding: `p-4` for feed cards and side panels.
- Compact controls: height `32–40px`.
- Common gaps: `gap-3` and `gap-4`.
- Keep the dashboard dense, but preserve readable line height and touch targets.

## Buttons and Interactions

- Primary button: steel-blue gradient, dark text, and restrained hover contrast.
- Secondary button: dark surface, thin border, muted text, brighter border/text on hover.
- Ghost button: transparent with hover surface.
- Active nav item: `--bg-active`, brand icon/text, and subtle brand border.
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
- Maintain contrast for steel-blue text on dark backgrounds.
- Do not rely on color alone to communicate Strict/Brave/Finished or locked/unlocked states.
