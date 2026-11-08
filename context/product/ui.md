# UI Context

[Context index](../README.md). Implementation conventions: [code standards](../engineering/code-standards.md); spoiler rules: [access policies](../architecture/auth-and-access.md).

## Visual Reference

[Dashboard reference](../images/dashboard/loresafe-dashboard-dark-reference.png) guides visual direction only; use **LoreSafe** as the app name.

Visual language: dark, compact, flat panels with thin borders, steel-blue brand accents, progress-aware cards, calm metadata, and clear locked/safe states.

## Theme Rules

- MVP is dark-mode first. Do not invent a light theme unless requested.
- Define colors as CSS custom properties and map them to Tailwind semantic tokens.
- Components must use semantic utilities such as `bg-base`, `bg-surface`, `border-default`, `text-primary`, `text-muted`, `bg-brand`, `text-brand`, and `ring-brand`.
- Do not hardcode hex colors or raw Tailwind palette colors inside feature components.
- shadcn/ui components should be mapped to these tokens rather than styled ad hoc per feature.

## Dark Tokens

[styles.css](../../apps/web/src/styles.css) owns all exact values, variants, shadows, gradients, dividers, and glass tokens. Use this role guide instead of copying values into components:

| Role            | Token family                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Surfaces        | `--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-subtle`, `--bg-inset`, `--bg-active`                                       |
| Borders         | `--border-default`, `--border-subtle`, `--border-strong`, `--border-brand`                                                     |
| Text            | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`, `--text-disabled`                                        |
| Brand           | `--accent-primary*`, `--accent-on-primary`, `--accent-secondary`, `--gradient-primary`                                         |
| States          | `--state-success` (read), `--state-warning` (Brave), `--state-error`, `--state-info` (locked), `--state-purple`, `--state-hot` |
| Progress/charts | `--chart-read`, `--chart-locked`, `--chart-available`, `--chart-future`                                                        |

## shadcn/ui Token Mapping

Map shadcn primitives to the semantic LoreSafe tokens:

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

## Liquid Glass Selection

- Shared tabs and tab-like controls use a translucent glass tray plus a decorative active indicator that moves between selected items.
- Use `Tabs`, `TabsList`, and `TabsTrigger` from `apps/web/src/shared/components/ui/tabs.tsx`; do not add per-feature active tab backgrounds or borders that fight the shared indicator.
- Use `LiquidSelectionIndicator` and `useLiquidSelection` from `apps/web/src/shared/components/ui/liquid-selection.tsx` for non-Radix controls that behave like tabs, sidebar navigation, or compact mode selectors.
- Animate the liquid/ripple only on selection changes: briefly compress during travel, spring back, and settle. No continuous animation.
- Use a stable `cacheKey` across navigation remounts to preserve the previous selection origin.
- Use smoother motion for vertical/stacked controls to avoid horizontal over-expansion.
- The indicator must stay `aria-hidden` and respect reduced-motion preferences.
- Keep the effect restrained for navigation, filters, and compact selectors. Do not convert every card, feed item, or large radio grid to glass by default.

## Typography

- UI font: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Mono font: `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- Titles are medium/semibold, not overly bold.
- Metadata should be small and calm, usually 12–14px.
- Avoid long uppercase labels except small section headers.

### Responsive Design Scale

- Root font size: `clamp(16px, min(1.041667vw, 1.851852svh), 40px)`; scale by the limiting viewport dimension, with a 16px baseline and 40px cap.
- Express typography, spacing, radii, structural rails, constrained containers,
  and responsive thresholds in `rem` unless a value must remain a physical
  pixel, such as a crisp border or the 320px minimum supported viewport.
- Verify large-screen changes for horizontal overflow at mobile, laptop, 1080p,
  1440p, and 4K viewport sizes.

## Radius and Borders

LoreSafe uses a softer, more circular radius scale from `apps/web/src/styles.css`
with `--radius: 1.125rem`.

| Context                   | Recommended class |
| ------------------------- | ----------------- |
| Inputs, filters, badges   | `rounded-md`      |
| Buttons and compact cards | `rounded-lg`      |
| Cards and panels          | `rounded-xl`      |
| App shell / large panels  | `rounded-2xl`     |
| Modal / overlay           | `rounded-2xl`     |
| Avatars                   | `rounded-full`    |
| Icon wells                | `rounded-lg`      |

Use these shared radius classes rather than arbitrary values; `styles.css` owns their scale.

Use 1px borders for most panels. Use brand borders sparingly for active/selected states.
For app-shell layout separation, prefer restrained elevation and faded token-based
section dividers over long isolated rules. Use the shared divider classes for
standalone section rules: `soft-section-divider`, `soft-section-divider-bottom`,
`soft-thread-divider`, and `soft-menu-separator`.

## Layout Patterns

### Primary App Shell

- Desktop uses a three-column app shell:
  - left sidebar: `15.75rem` (`252px` at the baseline scale).
  - main content: flexible, min width protected.
  - right sidebar: `20rem` (`320px` at the baseline scale).
- Use the full desktop viewport. Add listing-grid columns on wider screens; forms and reading pages may retain content-width limits.
- Main content has top search/header, club header, tabs, filters, feed cards, and lower summary panels.
- The desktop left sidebar uses the true-black page base; its nested controls
  retain their normal surface and active-state tokens.
- The desktop sidebar hides as one floating panel; expand the main column and show a compact brand-colored reopen control in the top bar. No permanent icon-only rail.
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

| Context           | Size   |
| ----------------- | ------ |
| Inline text icons | `14px` |
| Buttons/nav       | `18px` |
| Panel/card icons  | `20px` |
| Empty states      | `32px` |

Use stroke icons consistently. Avoid mixing emoji, 3D icons, and filled icon sets in core UI.

## Accessibility

- Every interactive element needs hover, focus-visible, disabled, and loading states.
- Badges must include text, not only color.
- Modals and drawers need keyboard focus management.
- Maintain contrast for steel-blue text on dark backgrounds.
- Do not rely on color alone to communicate Strict/Brave/Finished or locked/unlocked states.
