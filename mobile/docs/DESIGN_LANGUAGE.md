# PoultryManager Mobile — Design Language

> **Pattern name:** Hero gradient + bottom sheet
> Also known as: **branded immersive hero with elevated content sheet**.
> Inspired by Revolut, Wise, Robinhood, and the Apple Wallet redesign — adapted with a layered tonal palette inspired by Linear, Cash App, and Stripe Checkout.

This document is the source of truth for the visual language used across the PoultryManager mobile app, starting with the auth flow and Settings hub. Use it any time you build a new screen so the app stays consistent.

---

## 1. Anatomy

Every screen in this language has the same vertical structure:

```
┌────────────────────────────────────┐
│        STATUS BAR / NOTCH          │ ← system
├────────────────────────────────────┤
│ [back]                  [right]    │ ← optional toolbar (in hero)
│                                    │
│  [icon tile / avatar / banner]     │ ← optional heroExtra slot
│                                    │
│  Big Display Heading               │ ← title (28pt Poppins-Bold)
│  Subtitle in 85% white             │ ← optional subtitle
│                                    │
│         (gradient hero)            │
└────────────────────────────────────┘
   ╭──────────────────────────────╮
   │   ELEVATED SHEET (-24pt)     │ ← content sheet, rounded top
   │                              │
   │   ┌──────────────────────┐   │
   │   │  SECTION TITLE       │   │ ← uppercase eyebrow label
   │   │  ┌────────────────┐  │   │
   │   │  │ section card   │  │   │ ← rounded 18pt, soft fill
   │   │  └────────────────┘  │   │
   │   └──────────────────────┘   │
   │                              │
   │   ┌──────────────────────┐   │
   │   │  ANOTHER SECTION     │   │
   │   └──────────────────────┘   │
   │                              │
   │  [Primary CTA Button]        │
   │                              │
   ╰──────────────────────────────╯
```

### The four layers

| Layer | Purpose | Visual treatment |
|---|---|---|
| **1. Screen** | Sits behind everything — visible only briefly during navigation transitions or as a fail-safe behind the sheet at scroll bounce | Flat solid fill matching the system theme |
| **2. Hero gradient** | Identity, page title, primary navigation (back/close + right action) | Diagonal linear gradient in the brand color, full-bleed, **no rounded corners** (the sheet hides the bottom edge) |
| **3. Content sheet** | The actual page content | Rounded top (28pt), overlaps the gradient by **-24pt margin-top**, subtle inner shadow on top edge |
| **4. Section card** | Groups related controls inside the sheet | Rounded 18pt, soft tonal fill, subtle 1px shadow (light) or hairline border (dark), uppercase eyebrow label above |

Each layer is one measurable lightness step from the next so depth reads without explicit borders. **Never collapse two layers into the same color.**

### Critical scroll rule — the hero is FIXED, only the sheet scrolls

> **The hero NEVER scrolls.** It is anchored at the top of the screen, always inside the safe area. Only the sheet content scrolls underneath it.

This is a hard invariant of the language. Concretely:

- The gradient hero is rendered as a **sibling** of the scroll view, not inside it.
- The sheet itself is the scroll surface. Its rounded top (28pt) overlaps the bottom edge of the gradient by `-24pt margin-top`, but that overlap is purely visual — the hero stays fixed while the sheet's content scrolls behind it.
- Pull-to-refresh originates from the sheet, not from the gradient.

**Why this matters:**

1. **The title and toolbar must never collide with the system clock / notch.** If the hero scrolls, on long forms the user pulls the title under the status bar — looks broken, and was the bug that prompted this rule.
2. **Auth flows have the language switcher and theme toggle in the hero toolbar.** If those scroll out of reach the user has no way to change settings without scrolling back up.
3. **The brand identity (banner / avatar / icon tile) should always be visible.** Scrolling it away breaks the immersive feeling that defines the pattern.

`HeroSheetScreen` enforces this automatically — you don't need to do anything special. But if you ever feel tempted to wrap the whole thing in a single `<ScrollView>`, **stop**. That's the broken pattern this rule exists to prevent.

If a screen genuinely needs the hero to compress on scroll (rare — usually only iOS-style Large Title pages), build a custom layout, do not modify `HeroSheetScreen`. The pattern's strength is its predictability.

#### Exception — `scrollableHero` for tab landings

There is one sanctioned exception: tab landing screens that benefit from a "feed" feel may opt into `<HeroSheetScreen scrollableHero>`. The full hero (gradient + heroExtra + title/subtitle + heroBelow) scrolls away with the content, and a **compact pinned toolbar** (small title + the `headerRight` slot) fades in once the user has scrolled past the gradient. This way the module switcher, sync icon, and any other hero toolbar action stay reachable even when the hero itself has scrolled off.

**Allowed:** tab landings only — currently the dashboard. Use sparingly; pull-to-refresh + content density justify the cost.

**Not allowed:** sub-pages, forms, detail screens. The fixed-hero default still applies — title, back button, and `headerRight` must never collide with the status bar there.

---

## 2. Color tokens

Defined in `mobile/components/HeroSheetScreen.js` via `useHeroSheetTokens()`. All values are HSL so they tune cleanly across themes.

### Brand hue
- Primary green hue: `148°`
- Neutral hue (greens & grays): `150°`

### Light mode

| Token | HSL / Hex | Used for |
|---|---|---|
| `screenBg` | `hsl(140, 20%, 97%)` | Root screen background |
| `heroGradient` | `hsl(148, 60%, 22%)` → `hsl(148, 55%, 28%)` → `hsl(148, 48%, 36%)` | Hero (3-stop diagonal) |
| `sheetBg` | `#ffffff` | Content sheet |
| `sectionBg` / `cardBg` | `#ffffff` | Section cards (1px `sectionBorder` outline + soft shadow for depth) |
| `inputBg` | `hsl(148, 18%, 96%)` | Input fields (filled, low contrast) |
| `inputBorderIdle` | `hsl(148, 14%, 88%)` | Input border at rest |
| `inputBorderFocus` | `hsl(148, 60%, 30%)` | Input border on focus |
| `borderColor` | `hsl(148, 14%, 90%)` | Hairline dividers between rows |
| `sectionBorder` | `hsl(148, 14%, 88%)` | Outer border on `SheetSection` — **stronger than `borderColor`**. The shadow alone (`opacity: 0.04`) couldn't carry the edge against the off-white screen, so cards (and the tables/rows inside them on detail screens like SaleDetail) read as floating, edgeless blobs. A 12% L gap from white delineates the card without feeling heavy. |
| `elevatedCardBg` | `hsl(148, 22%, 95%)` | Tappable cards stacked **inside** a `SheetSection` (e.g. dashboard active batches). One layer above `sectionBg`. |
| `elevatedCardBorder` | `hsl(148, 16%, 84%)` | Border on elevated cards |
| `elevatedCardPressedBg` | `hsl(148, 22%, 89%)` | Pressed state for elevated cards |
| `textColor` | `#0f1f10` | Primary body text |
| `mutedColor` | `hsl(150, 10%, 45%)` | Secondary / helper / placeholder text |
| `iconColor` | `hsl(148, 30%, 35%)` | Icons inside inputs/rows at rest |
| `accentColor` | `hsl(148, 60%, 28%)` | Links, active states, focus rings |
| `errorColor` | `#dc2626` | Validation errors, destructive states |

### Dark mode

| Token | HSL / Hex | Used for |
|---|---|---|
| `screenBg` | `hsl(150, 22%, 11%)` | Root screen background |
| `heroGradient` | `hsl(148, 65%, 14%)` → `hsl(148, 55%, 22%)` → `hsl(148, 48%, 30%)` | Hero (3-stop diagonal — note the **higher saturation** in dark mode to keep the brand reading) |
| `sheetBg` | `hsl(150, 18%, 14%)` | Content sheet — **must be lighter than the gradient bottom** so the edge reads |
| `sectionBg` / `cardBg` | `hsl(150, 16%, 16%)` / `hsl(150, 16%, 18%)` | Section cards, slightly elevated |
| `inputBg` | `hsl(150, 16%, 18%)` | Input fields |
| `inputBorderIdle` | `hsl(150, 14%, 24%)` | Input border at rest |
| `inputBorderFocus` | `hsl(148, 55%, 50%)` | Input border on focus — bright/glowy |
| `borderColor` | `hsl(150, 14%, 22%)` | Hairline dividers |
| `sectionBorder` | `hsl(150, 12%, 28%)` | Outer border on `SheetSection` — **stronger than `borderColor`** because `sectionBg` only differs ~5% in lightness from `screenBg`; without a visible outline the section bleeds into the page in dark mode |
| `elevatedCardBg` | `hsl(150, 14%, 22%)` | Tappable cards stacked **inside** a `SheetSection` (e.g. dashboard active batches). One layer above `sectionBg`. |
| `elevatedCardBorder` | `hsl(150, 12%, 30%)` | Border on elevated cards — also stronger than `borderColor` for the same reason |
| `elevatedCardPressedBg` | `hsl(150, 16%, 28%)` | Pressed state for elevated cards |
| `textColor` | `#f0f5f0` | Primary body text |
| `mutedColor` | `hsl(148, 12%, 65%)` | Secondary / helper / placeholder text |
| `iconColor` | `hsl(148, 22%, 70%)` | Icons inside inputs/rows at rest |
| `accentColor` | `hsl(148, 55%, 55%)` | Links, active states |
| `errorColor` | `#fca5a5` | Validation errors |

### Lightness ladder (the most important rule)

Each layer is **at least 2 lightness points** above the layer beneath it. This is what creates depth without explicit borders.

```
Light mode:   screen 97% → sheet 100% → section 100% (1px border + shadow) → elevated card 95% → input 96%
Dark mode:    screen 11% → sheet 14% → section 16% (1px border)            → elevated card 22% → pressed 28%
```

**Section / card outlines are required in BOTH themes.** Always set `borderWidth: 1` + `borderColor: sectionBorder` on `SheetSection` (and `borderColor: elevatedCardBorder` on cards inside it).

- In **dark mode** the lightness gap between section and screen is only ~5%, so without an outline the section bleeds into the page.
- In **light mode** the gap between `#ffffff` section and the off-white screen is only ~3% — the soft shadow alone (`opacity: 0.04`) couldn't carry the edge, especially on detail pages with stacked tables and totals strips. A 1px outline at `sectionBorder` (12% L gap from white) keeps every card unambiguously bounded.

The pattern previously gated this border on `dark ? 1 : 0` — that's no longer correct. New components must apply the border in both themes; the shadow stays light-mode-only as a secondary depth cue.

If two adjacent layers end up the same lightness, **add a +2% step** to the inner layer or the design will look flat and muddy.

### When to use which surface

| Surface | Token | Sits on | Example |
|---|---|---|---|
| Section card (the page's primary content grouping) | `sectionBg` + `sectionBorder` | `sheetBg` | Net Profit card, Flock card, Active Batches container |
| Elevated card (a tappable card stacked **inside** a section) | `elevatedCardBg` + `elevatedCardBorder` | `sectionBg` | Each individual batch row inside Active Batches |
| Input field | `inputBg` + `inputBorderIdle` | `sectionBg` | Text inputs, search boxes |

A common mistake is to nest a `SheetSection` inside another `SheetSection` — don't. If you need an inner card, use `elevatedCardBg`.

---

## 3. Typography

We use **Poppins** across the app. The hero title is the only place we use display sizing.

| Use | Font | Size | Line height | Letter spacing |
|---|---|---|---|---|
| Hero title | Poppins-Bold | 28 | 34 | -0.5 |
| Hero subtitle | Poppins-Regular | 14 | 20 | 0 |
| Section title (eyebrow label) | Poppins-SemiBold | 11 | — | 1.2, **uppercase** |
| Section description | Poppins-Regular | 12 | 17 | 0 |
| Field label | Poppins-Medium | 13 | — | 0 |
| Input text | Poppins-Regular | 15 (52pt) / 14 (44pt dense) | — | 0 |
| Settings row label | Poppins-Medium (Poppins-SemiBold if destructive) | 15 | — | 0 |
| Settings row value | Poppins-Regular | 13 | — | 0 |
| CTA button label | Poppins-SemiBold | 15 | — | 0 |
| Pill / badge label | Poppins-SemiBold | 11 | — | 0.4 |
| Hint / error / footer | Poppins-Regular | 12 | — | 0 |
| Trust line | Poppins-Regular | 11 | — | 0 |

**Rule of thumb:** if you're tempted to introduce a new size, snap to the nearest existing one.

---

## 4. Spatial system

| Use | Value |
|---|---|
| Screen horizontal gutter | 16pt (matches `SheetSection` margin-horizontal) |
| Section vertical gap (between cards) | 16pt |
| Inside a section card | 16pt all sides (default; pass `padded={false}` for row-based content) |
| Between fields in a form | 14pt |
| Between two horizontally paired fields | 10pt column gap |
| Hero padding (top) | safe-area-inset-top + (8pt with toolbar / 28pt without) |
| Hero padding (bottom) | 56pt — leaves room for the sheet overlap |
| Hero padding (horizontal) | 20pt |
| Sheet overlap | -24pt margin-top |
| Sheet padding (top) | 24pt |
| Sheet padding (bottom) | safe-area-inset-bottom + 24pt |

### CRITICAL — sheet content gutter rule

> **Don't add `paddingHorizontal` to `HeroSheetScreen`'s `contentStyle` if your sheet uses `SheetSection`s.**

`SheetSection` already provides the screen gutter via its **`marginHorizontal: 16`**. If you also pass `contentStyle={{ paddingHorizontal: 20 }}` you get a doubled-up `20 + 16 = 36pt` gutter on sections, which makes the page look weirdly inset. Worse: the inner card padding (`16pt`) plus row padding (`14pt`) compounds further, pushing icon tiles 60pt+ from the screen edge.

**Recipes:**

```jsx
// ✅ Sectioned screen — let SheetSection handle the gutter.
<HeroSheetScreen title="..." subtitle="...">
  <SheetSection title="PERSONAL INFO">
    <SheetInput label="..." />
    <SheetInput label="..." />
  </SheetSection>
  <SheetSection title="ACCOUNT">
    <SheetInput label="..." />
  </SheetSection>

  {/* Loose content (CTA, sign-in link, terms line) needs explicit
      marginHorizontal: 16 to match the sections. */}
  <View style={{ marginHorizontal: 16, gap: 14, marginTop: 4 }}>
    <Button>Save</Button>
  </View>
</HeroSheetScreen>

// ✅ Bare-form screen (no SheetSections) — opt into a 20pt gutter via contentStyle.
//    Use this only when the entire sheet is a single flat form, like the login screen.
<HeroSheetScreen
  title="..."
  contentStyle={{ paddingHorizontal: 20, gap: 18 }}
>
  <FieldShell />
  <FieldShell />
  <Button>Submit</Button>
</HeroSheetScreen>
```

```jsx
// ❌ DOUBLE GUTTER — SheetSection sits 36pt from the screen edge instead of 16pt.
<HeroSheetScreen contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
  <SheetSection title="...">
    ...
  </SheetSection>
</HeroSheetScreen>
```

**Pop-quiz heuristic before pushing a screen:** open the simulator, hold a finger from the leftmost edge of the section card and the leftmost edge of a row inside it. The card should feel like it lives at the *same* gutter as the screen (16pt). If the card is more than ~16pt deeper than the screen edge, you've doubled up.

### Section padding for row-style content

When a section's children are themselves padded "card rows" (settings rows, module picker rows, batch list cards), pass `padded={false}` on the `SheetSection`. Otherwise the section's built-in 16pt padding stacks on top of each row's internal padding, making rows feel cramped and adding a hollow ring of empty space around them.

```jsx
// ✅ Each module row paints its own padding/border/background.
<SheetSection title="SELECT MODULES" padded={false}>
  <View style={{ gap: 10 }}>
    {modules.map((m) => (
      <Pressable style={{ padding: 14, borderRadius: 16, ... }}>
        ...
      </Pressable>
    ))}
  </View>
</SheetSection>

// ❌ Rows feel padded-in-padded; outer empty ring of section padding looks awkward.
<SheetSection title="SELECT MODULES">
  <Pressable style={{ padding: 14, ... }}>...</Pressable>
</SheetSection>
```

### Border radii

| Element | Radius |
|---|---|
| Sheet top corners | 28pt |
| Section card | 18pt |
| Input field | 14pt |
| Primary CTA button | 16pt (`rounded-2xl`) |
| Icon tile (settings row, hero badge) | 10pt or 18pt depending on size |
| Pill / badge | 999pt (full pill) |
| Avatar tile in hero | 22pt for 64pt, 18pt for 56pt |
| Circular back button | 18pt (half of 36pt) |

---

## 5. Shadow & elevation

Mobile shadows are subtle. Never use `shadowOpacity > 0.2` in light mode — it looks AI-generated.

| Element | Light | Dark |
|---|---|---|
| Sheet (top edge) | `shadowOffset: {0, -4}, opacity: 0.06, radius: 12` | `shadowOffset: {0, -4}, opacity: 0.40, radius: 12` |
| Section card | `shadowOffset: {0, 1}, opacity: 0.04, radius: 8` | None — use `borderWidth: 1` with `borderColor` instead |
| Hero icon tile / avatar | `shadowOffset: {0, 4}, opacity: 0.18, radius: 12` | Same |

**Pattern:** in light mode lean on shadows, in dark mode lean on hairline borders. They cost roughly the same visual weight but feel right per theme.

---

## 6. Components

These three components implement the language. Compose them — don't reach below them.

### `HeroSheetScreen`
The screen layout wrapper. Renders the gradient hero (with optional toolbar, header-right slot, and extra-content slot) and the rounded-top content sheet.

The hero is **always anchored at the top** inside the safe area — it never scrolls. Only the sheet's children scroll. (See the "Critical scroll rule" in §1.)

```jsx
import HeroSheetScreen from '@/components/HeroSheetScreen';

<HeroSheetScreen
  title="Settings"
  subtitle="Manage your account, team, and preferences"
  showBack={false}              // false for tab screens, true for stack screens (default true)
  onBack={() => setSection('main')}  // optional, defaults to router.back()
  heroExtra={<UserAvatarRow />}      // optional render slot above the title
  headerRight={<RoleBadge />}        // optional render slot top-right
  heroBelow={<QuickStats />}         // optional render slot below the title
  keyboardAvoiding                   // wrap in KeyboardAvoidingView for forms
  scrollable                         // wrap sheet children in ScrollView (default true)
>
  <SheetSection title="Section">…</SheetSection>
</HeroSheetScreen>
```

**Props quick reference**

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | string | — | Hero title (required) |
| `subtitle` | string | — | Hero subtitle |
| `showBack` | bool | `true` | Show circular back button |
| `onBack` | fn | `router.back()` | Custom back handler |
| `headerRight` | node | — | Top-right toolbar slot (badge, action) |
| `heroExtra` | node | — | Block above the title (avatar, icon tile, banner) |
| `heroBelow` | node | — | Block below the title (quick stats, segmented control) |
| `scrollable` | bool | `true` | Wrap sheet children in ScrollView. **Hero is never scrollable in default mode** |
| `scrollableHero` | bool | `false` | **Tab landings only.** Hero scrolls with content; a compact pinned toolbar (small title + `headerRight`) fades in past the fade window. See §1 "Exception — `scrollableHero` for tab landings". |
| `keyboardAvoiding` | bool | `false` | Wrap the whole layout in KeyboardAvoidingView |
| `contentStyle` | style | — | Style override applied to the **sheet content container** (the inner stack holding `children`). Use this for `paddingHorizontal`, `gap`, etc. — NOT the sheet shell |
| `refreshControl` | node | — | `RefreshControl` element passed to the sheet's ScrollView. Pull-to-refresh originates from the sheet, not the hero |

### `SheetSection`
Grouped card used inside the sheet. Provides the uppercase eyebrow label, rounded card body with **built-in 16pt padding**, and optional description.

```jsx
import SheetSection from '@/components/SheetSection';

<SheetSection
  title="Personal Information"     // uppercase eyebrow label
  icon={UserIcon}                  // optional icon next to the label
  description="Update your details"  // optional helper text below the card
  padded={false}                   // pass false for row-based content (settings rows)
                                   //   that should butt up against the card edges
>
  {/* form fields, rows, etc. */}
</SheetSection>
```

**When to set `padded={false}`:**
- Settings rows (the row Pressable handles its own horizontal padding)
- Anything where the children should reach the card edges (full-width images, custom row components)

For form fields, leave `padded` at the default `true` — the section gives you 16pt of breathing room on all sides.

### `SheetInput` / `SheetCurrencyInput`
Soft-fill input matching the language. Icon-prefixed, focus-glow border, error/hint slot, optional suffix.

```jsx
import SheetInput, { SheetCurrencyInput } from '@/components/SheetInput';
import { Mail } from 'lucide-react-native';

<SheetInput
  label="Email"
  icon={Mail}
  value={email}
  onChangeText={setEmail}
  placeholder="you@company.com"
  error={errors.email?.message}
  hint="We'll never share your email"
  dense                            // 44pt instead of 52pt for grids
  suffix={<MyEyeToggle />}         // arbitrary right-side element
/>

<SheetCurrencyInput
  label="Rate per Truck"
  value={rate}
  onChangeText={setRate}
  currency="AED"                   // pill on the right
/>
```

### `BottomPickerSheet`
Swipeable bottom sheet for "pick one from a list." Owns the modal, the slide+backdrop animation, the swipe-to-dismiss `PanResponder`, the keyboard dismiss-on-close, and a ref-driven `open()` / `close()` API.

**Use this for any "pick X from a list" flow** — language, currency, country, supplier, batch, contact, etc. Don't roll your own modal+list.

`BottomPickerSheet` does NOT render its own trigger. The consumer paints the trigger (a button, a hero pill, a settings row) and calls `ref.open()`. Same primitive backs both `Select` (the form-grade trigger) and `LanguageSelector` (the hero-pill trigger).

```jsx
import { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import BottomPickerSheet from '@/components/BottomPickerSheet';
import { Languages } from 'lucide-react-native';

const sheetRef = useRef(null);

return (
  <>
    <Pressable onPress={() => sheetRef.current?.open()}>
      <Text>{currentValue.label}</Text>
    </Pressable>

    <BottomPickerSheet
      ref={sheetRef}
      icon={Languages}                                // optional accent-tinted icon tile
      title="Language"
      subtitle="Choose the app language"
      forceSearchable                                 // show search even with <= 5 items
      searchPlaceholder="Search language…"
      searchFields={['label', 'native', 'code']}      // which option fields to filter on
      sheetHeightFraction={0.85}                      // 0.65 by default; bump to 0.85 for long lists
      options={[{ value, label, description, ... }]}
      value={selected}
      onValueChange={setSelected}
      renderItem={({ item, isSelected, onPress }) => <CustomRow ... />}  // optional, defaults to a clean label/desc row
    />
  </>
);
```

**Header structure (matches the icon-tile-and-eyebrow pattern from §8):**

- **16pt drag zone** at the top with a slim 4pt grab pill (NOT a 44pt empty header — that wastes space and looks like a bug).
- **Optional 40pt accent-tinted icon tile** on the leading edge.
- **Title** (Poppins-SemiBold 17, `textColor`) + **subtitle** (Poppins-Regular 13, `mutedColor`), `textAlign` driven by `useIsRTL`.
- **Optional `headerRight`** slot for action chips (e.g. "Add New", "Clear").
- **Circular close X button** on the trailing edge.

Then a `SheetInput`-styled search box, a hairline divider, and the FlatList.

**Props quick reference**

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | string | — | Sheet title (required) |
| `subtitle` | string | — | Sheet subtitle (under the title) |
| `icon` | LucideIcon | — | Leading icon tile glyph |
| `headerRight` | node | — | Optional element shown before the close button |
| `searchable` | bool | `true` | Show the search input |
| `forceSearchable` | bool | `false` | Show search even when `options.length <= 5` |
| `searchPlaceholder` | string | `'Search…'` | Placeholder text in the search input |
| `searchFields` | string[] | `['label', 'description']` | Option fields to filter on (case-insensitive) |
| `options` | array | `[]` | `{ value, label, description?, ... }` items |
| `value` | any | — | Currently selected option's `value` |
| `onValueChange` | fn | — | `(value) => void` |
| `renderItem` | fn | — | `({ item, isSelected, onPress, primaryColor }) => Node` — custom row; falls back to a clean default |
| `sheetHeightFraction` | number | `0.65` | Sheet height as a fraction of the screen |
| `onOpen` | fn | — | Called when the sheet opens |
| `onSearchChange` | fn | — | Called when the user types in the search box |
| `emptyState` | node | — | Custom empty-state node (replaces default copy) |

**Custom rows must follow the `StyleSheet`-row rule.** When you pass `renderItem`, your Pressable must use a static style array (not a function) and the row's `flexDirection: 'row'` must live on a plain inner `<View>`, not on the Pressable. Otherwise rows render as a vertical column. See §9 "NativeWind / Pressable functional-style trap."

### `Select` (form-grade thin wrapper around `BottomPickerSheet`)

`Select` is a thin wrapper over `BottomPickerSheet` that adds:
- The default form-style trigger Pressable (border + chevron + label)
- `onCreateNew` "Add New" header pill + an empty-state "Create '…'" CTA
- `clearable` — Clear pill in the header + inline clear X in the trigger
- `renderTrigger` escape hatch for callers that paint their own trigger (e.g. a custom hero pill)

Use `Select` when you're inside a form (the form shows the user's current selection in a labelled trigger). Use `BottomPickerSheet` directly when the trigger is unconventional — a translucent hero pill, an icon-only tap target, an inline list header, etc.

`Select`'s public API is unchanged from before the `BottomPickerSheet` extraction. All 12 existing form callers (`ContactSheet`, `ExpenseSheet`, `SaleOrderSheet`, etc.) work without modification and inherit the new icon-tile header automatically.

### `DatePicker` (form-grade single-date picker)

Single-day version of `DateRangePicker`. Same compact trigger as `Select`, same `BottomPickerSheet`-style modal chrome (drag pill, header with title + Today / Clear pills + close X, calendar grid).

```jsx
import DatePicker from '@/components/ui/DatePicker';

<DatePicker
  value={startDate}                          // 'YYYY-MM-DD' or '' / null
  onChange={setStartDate}                    // called with ISO string, or '' on Clear
  label={t('batches.startDate')}             // shown as the modal header
  placeholder={t('common.selectDate')}       // optional; defaults to translated "Select date…"
/>
```

Public API: `value`, `onChange`, `placeholder`, `label`, `onOpen`, plus a forwarded ref with `open()` / `close()`.

### Form-grade trigger sizing — KEEP IT COMPACT

> **Triggers like `Select` and `DatePicker` live INSIDE a `FormSection` card, NEXT TO `SheetInput`s. They must NOT shout.**

The compact recipe both components share:

| Property | Value | Rationale |
|---|---|---|
| `height` | `48` | One step *shorter* than `SheetInput` (52). Keeps the row dense; the FormField label above does the heavy lifting. |
| `borderWidth` | `1` | Hairline outline, not the 1.5pt focus-grade border `SheetInput` uses. |
| `borderRadius` | `10` | Slightly tighter than `SheetInput`'s 14pt. |
| `paddingHorizontal` | `12` | Matches `SheetInput`'s breathing room. |
| `backgroundColor` | `inputBg` | One step *lighter* than `sectionBg` so the trigger reads as a tap target on the card. |
| `borderColor` | `inputBorderIdle` | Same idle border as `SheetInput`. Avoid an "active" focus border on the trigger — there's no focus state, only "open or not." |
| Text | `14pt Poppins-Regular` | Matches the SheetInput value text size. Use `textColor` when filled, `mutedColor` for the placeholder. |
| Trailing affordance | `16pt` chevron / icon | `iconColor`, `strokeWidth: 2.2`. |

❌ **Do not** scale form triggers up to 52pt height + 1.5pt borders + 14pt radius "to match `SheetInput`". They are deliberately one notch lighter so a stack of `[ Farm ▾ ] [ Date 📅 ] [ Status • • • ]` doesn't look like three competing buttons.

❌ **Do not** add an icon tile inside the trigger or its modal sheet header. The `BottomPickerSheet` icon tile is for *picker sheets that don't have any other visual identity*. `DatePicker`'s calendar grid IS the identity — doubling it up with a green calendar tile in the header is redundant chrome.

✅ **Do** route the trigger Pressable through the §9 recipe: STATIC style array on the Pressable, layout (`flexDirection`, `alignItems`, `gap`) on a plain inner `<View>`. Without this, NativeWind's css-interop strips `flexDirection` and the chevron stacks below the label. This is exactly the bug the trigger has shipped with twice — once with the className-based version, once with the functional-style refactor.

### `useHeroSheetTokens()`
Hook returning all the color tokens for the current theme. Use it in any custom row/widget so you stay on-palette.

```jsx
const { textColor, mutedColor, accentColor, sectionBg, dark } = useHeroSheetTokens();
```

---

## 7. Hero patterns

The hero is the personality of the screen. Pick the pattern that matches the screen's purpose.

### a. User-identity hero (Settings hub)
Avatar tile + name + email + tiny role pill. No back button (it's a tab landing).

```jsx
<HeroSheetScreen
  title={t('nav.settings')}
  subtitle={t('settings.subtitle')}
  showBack={false}
  heroExtra={
    <Pressable onPress={openProfile} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ height: 64, width: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 24, color: 'hsl(148, 60%, 22%)' }}>JD</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 18, fontFamily: 'Poppins-SemiBold', color: '#fff' }}>Jane Doe</Text>
        <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: 'rgba(255,255,255,0.78)' }}>jane@company.com</Text>
      </View>
    </Pressable>
  }
>
  …
</HeroSheetScreen>
```

### b. Icon-tile hero (sub-pages)
Translucent white tile with a single lucide icon, used for sub-screens like Modules, Accounting, Sale Defaults, Security.

```jsx
<HeroSheetScreen
  title={t('settings.modules')}
  subtitle={t('settings.modulesDesc')}
  heroExtra={
    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
      <Puzzle size={26} color="#fff" strokeWidth={2} />
    </View>
  }
  headerRight={
    <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#fff', letterSpacing: 0.4 }}>3 Active</Text>
    </View>
  }
>
  …
</HeroSheetScreen>
```

### c. Brand hero (auth)
PoultryManager banner instead of an icon tile. No back button. Used for the login screen.

```jsx
<HeroSheetScreen
  title={t('auth.loginGreeting')}
  subtitle={t('auth.loginPrompt')}
  showBack={false}
  heroExtra={<Image source={require('@/assets/images/banner-white.png')} style={{ width: 220, height: 56 }} resizeMode="contain" />}
>
  …
</HeroSheetScreen>
```

### d. Time-aware personal hero (dashboard)
Personalized greeting that swaps icon and copy based on the local hour, with the `headerRight` slot carrying the module switcher and sync button. Used for the dashboard tab.

```jsx
const HeroIcon = hour < 12 ? Sunrise : hour < 17 ? Sun : hour < 22 ? Sunset : Moon;
const greetingKey =
  hour < 5  ? 'dashboard.greetingNight'   :
  hour < 12 ? 'dashboard.greetingMorning' :
  hour < 17 ? 'dashboard.greetingAfternoon' :
  hour < 22 ? 'dashboard.greetingEvening' :
              'dashboard.greetingNight';

<HeroSheetScreen
  title={t(greetingKey, { name: user.firstName })}
  subtitle={localizedDate}
  showBack={false}
  heroExtra={<TranslucentTile><HeroIcon size={26} color="#fff" /></TranslucentTile>}
  headerRight={
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <ModuleSwitcher compact />
      <SyncIconButton />
    </View>
  }
  heroBelow={quickStats?.length ? <HeroQuickStats stats={quickStats} /> : null}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
>
  {widgets.map((W) => <W.component key={W.id} />)}
</HeroSheetScreen>
```

The `heroBelow` slot here is a "data pulse" — a row of translucent-white pills (icon + value + label) sourced from the active module via the **widget quick-stats contract** (see §13).

### Hero toolbar elements

| Element | Look | Use for |
|---|---|---|
| Circular back button | 36pt circle, `rgba(255,255,255,0.18)` bg, white chevron-left | Sub-screens (default) |
| Right pill badge | `rgba(255,255,255,0.18)` bg, full pill, 11pt SemiBold white text | Counts, role labels, currency, status |
| Right icon button | 36pt circle, `rgba(255,255,255,0.18)` bg, white icon | Settings cog, share, etc. |

**All translucent toolbar elements use `rgba(255,255,255,0.18)` and white content.** Never use the brand green here; it would collide with the gradient.

---

## 8. Sheet content patterns

### a. Settings row
Tappable row with a colored icon tile, label, optional value, and chevron.

```jsx
function SettingsRow({ icon: Icon, label, value, onPress, destructive, isLast }) {
  const { iconColor, mutedColor, textColor, errorColor, borderColor, dark } = useHeroSheetTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
        backgroundColor: pressed ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent',
        borderRadius: 14,
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: destructive ? 'rgba(220,38,38,0.08)' : 'hsl(148, 30%, 95%)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Icon size={16} color={destructive ? errorColor : iconColor} strokeWidth={2.2} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontFamily: destructive ? 'Poppins-SemiBold' : 'Poppins-Medium', color: destructive ? errorColor : textColor }}>{label}</Text>
      {value && <Text style={{ fontSize: 13, color: mutedColor, marginRight: 8 }}>{value}</Text>}
      {onPress && !destructive && <ChevronRight size={16} color={mutedColor} />}
    </Pressable>
  );
}
```

### b. Segmented control (theme switcher)
Three equal pills inside a section card. Active pill: `accentColor` border + tinted bg + accent text/icon. Inactive: transparent.

### c. Module / item card with status pill
Larger card with a colored icon tile (color comes from the entity, not the brand), title, subtitle, and a right-side status pill.

```jsx
<View style={{
  flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16,
  backgroundColor: sectionBg,
  borderWidth: dark ? 1 : 0, borderColor,
}}>
  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: `${entityColor}1F`, alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={20} color={entityColor} />
  </View>
  <View style={{ flex: 1, gap: 2 }}>
    <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: textColor }}>Title</Text>
    <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }} numberOfLines={2}>Description</Text>
  </View>
  <StatusPill />
</View>
```

### d. Status pills
Always full pill (`borderRadius: 999`), 10pt vertical / 5pt horizontal padding, 11pt SemiBold text.

| State | Background | Foreground |
|---|---|---|
| Success / active | `accentColor` at 16% (dark) / `hsl(148, 35%, 92%)` (light) | `accentColor` |
| Locked / disabled | transparent + `borderColor` | `mutedColor` |
| Destructive | `errorColor` at 12% / 8% | `errorColor` |
| Hero (on gradient) | `rgba(255,255,255,0.18)` | `#ffffff` |

### e. Primary CTA
```jsx
<Button onPress={save} loading={saving} disabled={saving} size="lg" className="w-full rounded-2xl">
  <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>Save</Text>
</Button>
```

White text on `bg-primary` in **both themes** — never dark text on the dark-mode primary, it looks muddy.

### f. Form layout
- One field per row by default.
- Pair short related fields horizontally with `gap: 10` (e.g. First Name / Last Name, City / State).
- 14pt vertical gap between fields.
- 16pt padding inside the section card.
- Read-only fields use `editable={false}` and `opacity: 0.6` is applied automatically.
- Use `hint` for helper text that's always shown, `error` for validation that turns the border red.

### g. Picker sheet rows

When you supply a `renderItem` to `BottomPickerSheet` (or `Select`), keep the visual mapped to the same anatomy across the app so every picker feels like the same picker:

| Slot | Position | Contents |
|---|---|---|
| Leading visual | first column, 28-44pt wide | Flag tile (locale picker), code badge (`EN`, `AR`), entity-color icon tile (modules), avatar (contacts), or thumbnail (media) |
| Title | second column, `flex: 1` | 15pt Poppins-SemiBold, `textColor` |
| Subtitle | second column, below title | 12pt Poppins-Regular, `mutedColor`, optional |
| Trailing affordance | third column, fixed width | 26pt accent-green check disc when selected; lock chip / chevron / nothing otherwise |

```jsx
function MyPickerRow({ item, isSelected, onPress }) {
  const { dark, accentColor, textColor, mutedColor } = useHeroSheetTokens();
  const bg = isSelected
    ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
    : 'transparent';

  return (
    <Pressable onPress={onPress} style={[rowStyles.outer, { backgroundColor: bg }]}>
      <View style={rowStyles.row}>
        <View style={rowStyles.leading}>{/* flag / badge / avatar */}</View>
        <View style={rowStyles.textCol}>
          <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: textColor }}>
            {item.label}
          </Text>
          {item.description ? (
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor, marginTop: 2 }}>
              {item.description}
            </Text>
          ) : null}
        </View>
        {isSelected ? <SelectedDisc accentColor={accentColor} /> : null}
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  outer: { paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },         // ← row layout on a plain View
  leading: { width: 44, marginRight: 14, justifyContent: 'center', alignItems: 'flex-start' },
  textCol: { flex: 1, minWidth: 0 },
});
```

Reference: [`mobile/components/LanguageSelector.js`](../components/LanguageSelector.js) (`LanguageRow`).

### h. Status / progress / popout

Three related but distinct overlay patterns. Pick by the user's context, not by what feels new:

#### 1. Hero-icon popout floater

When a hero-toolbar icon (sync, notifications, search) needs a small, dense, **glanceable** panel that visually points back at its trigger — use the popout floater. Looks and feels like a desktop-style anchored popover but lives inside a `<Modal>` so it can never be clipped by the hero gradient or any other parent's `overflow: hidden`.

- Trigger stays a 36pt translucent-white circle in the hero toolbar
- On tap, `measureInWindow()` the trigger's screen-coords; render the popover anchored there
- Spring-bounce open: `Easing.out(Easing.back(1.4))` on `scaleAnim` (0.85 → 1) + opacity (0 → 1) + slight `translateY` drop (-8 → 0). 220ms scale, 180ms opacity. Feels like the icon is "ejecting" the panel.
- Arrow nub (12pt rotated 45°) sits above the card, centred on the trigger icon — visual breadcrumb back to where the panel came from
- Card width: `min(screenWidth - 32, 320)`. Always has a 16pt minimum gap from the screen edge.
- Card body: a header row (`Sync Status` + close X), then a status meta card, then an action row, then optional failed-entries list. Inner ScrollView caps at 360pt so the floater never grows monstrous.

```jsx
const triggerRef = useRef(null);
const [anchor, setAnchor] = useState(null);

const show = () => {
  triggerRef.current?.measureInWindow((x, y, w, h) => {
    setAnchor({ x, y, width: w, height: h });
    setOpen(true);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  });
};

return (
  <View>
    <Pressable ref={triggerRef} onPress={open ? hide : show}>{/* 36pt icon */}</Pressable>

    <Modal transparent visible={open} statusBarTranslucent animationType="none">
      {/* Tap-anywhere-to-dismiss backdrop */}
      <Pressable onPress={hide} style={StyleSheet.absoluteFill} />

      {anchor && (
        <Animated.View
          style={{
            position: 'absolute',
            top: anchor.y + anchor.height + 8,
            left: clampedLeftFromAnchor(anchor),
            width: POPOVER_WIDTH,
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              { translateY: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            ],
          }}
        >
          <ArrowNub />
          <Card>{/* header / meta / actions / list */}</Card>
        </Animated.View>
      )}
    </Modal>
  </View>
);
```

**Why a popout, not a bottom sheet?** Use this when the panel is **secondary chrome** the user pokes for a quick check (sync status, notification preview, search filters). Bottom sheets are heavier — they pull focus, dim the whole screen, and feel like a destination. The popout stays light, points back at the icon, and dismisses on any outside tap.

**Why it lives in a Modal:** the previous version anchored the popover relative to the trigger's wrapper using `position: 'absolute'` + a 4000pt-tall negative-inset backdrop. That broke when the trigger sat inside a parent with `overflow: hidden` (the hero gradient does this). Putting the popover inside `<Modal>` puts it on its own native window, where nothing can clip it; the `measureInWindow` math + spring animation re-create the original "comes from the icon" feel without the brittle positioning hack.

#### 2. Status sheet

When the status info is the destination — i.e. the user came here specifically to see settings, manage failed mutations, configure something — escalate to a bottom sheet. Same primitives as `BottomPickerSheet`:

- 16pt drag zone with slim 4pt grab pill
- Compact icon-tile + title + subtitle header
- Circular close X on the trailing edge
- Drag-to-dismiss + tap-outside-to-dismiss
- Body in grouped blocks: meta card → primary action row → secondary list

We don't currently have one of these in the codebase — the sync UI uses the popout pattern (above). When you need a status sheet, copy the structure from `BottomPickerSheet` and replace the `FlatList` with your status content.

#### 3. Progress overlay (non-dismissable)

When the **system** is doing a one-shot operation that blocks the UI (initial sync, full resync, file upload), use a centred progress card on a brand-tinted backdrop:

```jsx
<Modal transparent statusBarTranslucent animationType="fade">
  <View style={StyleSheet.absoluteFill}>
    <LinearGradient colors={heroGradient} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
  </View>
  <View style={centeredCard}>
    <DragPill />            {/* purely decorative — non-dismissable */}
    <BigIconTile />         {/* 64pt accent-tinted */}
    <Title />
    <Subtitle />
    <ProgressBar />         {/* accent fill or sliding indeterminate */}
    <StepLabel />           {/* "Step 4 of 22" or "Fetching X…" */}
  </View>
</Modal>
```

The brand-tinted backdrop (gradient under a 55% screen-coloured layer) makes the overlay feel like the **app overlaying itself** instead of a generic system dialog.

References:
- **Hero-icon popout floater:** [`mobile/components/SyncIconButton.js`](../components/SyncIconButton.js) — the canonical example. Trigger pill + Modal-anchored popover + measure-and-spring animation
- **Progress overlay:** [`mobile/components/FullResyncOverlay.js`](../components/FullResyncOverlay.js) — driven by `useSyncStore`'s `isFullResyncing` / `isInitialSyncing` flags

---

## 9. Interaction & motion

| Interaction | Behavior |
|---|---|
| Tapping any row, button, toggle | `Haptics.selectionAsync()` on `onPressIn` (fires before the finger lifts so the response feels instant) |
| Submitting a form successfully | `Haptics.notificationAsync(Success)` |
| Submit failure / error | `Haptics.notificationAsync(Error)` |
| Pressed state (transparent rows) | Background tint shifts ~3-4% (`rgba(255,255,255,0.04)` dark / `rgba(0,0,0,0.03)` light) |
| Pressed state (cards on a tinted surface) | Background steps to a more saturated tint (`hsl(150, 18%, 24%)` dark / `hsl(148, 18%, 90%)` light), border swaps `borderColor → accentColor`, plus `transform: [{ scale: 0.985 }]` and `opacity: 0.95`. Use `android_ripple` so Android gets a ripple too. Always wire haptics on `onPressIn`. |
| Pressed state (buttons) | `active:bg-primary/90` (handled by the Button component) |
| Focus on input | Border animates from `inputBorderIdle` → `inputBorderFocus` (1.5pt thick, `accentColor`); icon color also shifts to focus color |
| Indeterminate progress | Use the `FullResyncOverlay`'s sliding-bar animation pattern |
| Theme switch | Instant — no transition; the layered tones make it feel intentional |

**Never animate the gradient.** It's a backdrop, not a feature.

### CRITICAL — the NativeWind / `Pressable` functional-style trap

> **Do NOT put `flexDirection`, `borderWidth`, `borderColor`, `backgroundColor`, or any other layout-bearing style inside a `Pressable`'s functional `style={({ pressed }) => ({ ... })}` form.**
>
> NativeWind's `react-native-css-interop` re-shapes those returned objects for its CSS interop layer and **silently drops layout properties**. The card / row collapses to `flexDirection: 'column'`, the border disappears, the background washes out — and there's no warning in the bundler. We have hit this twice (module picker rows, language sheet rows) and lost a full UI iteration each time.

**The fix has three rules:**

1. **All static layout lives in `StyleSheet.create`.** That goes through RN's static style sheet system *before* the interop layer touches it.
2. **The Pressable uses a static style array, not a function.** `style={[styles.outer, dynamicBg]}` — never `style={({ pressed }) => ({...})}` for layout.
3. **The actual row layout (`flexDirection: 'row'`, gap, alignItems) lives on a plain `<View>` *inside* the Pressable**, not on the Pressable itself.

```jsx
import { StyleSheet, Pressable, View, Text } from 'react-native';

function MyRow({ isSelected, onPress }) {
  const { dark, accentColor, sectionBg, textColor } = useHeroSheetTokens();
  const bg = isSelected
    ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
    : sectionBg;

  return (
    <Pressable onPress={onPress} style={[styles.outer, { backgroundColor: bg }]}>
      <View style={styles.row}>
        <View style={styles.iconTile}>{/* icon */}</View>
        <View style={styles.textCol}>
          <Text style={{ color: textColor }}>Label</Text>
        </View>
        {/* trailing affordance */}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',          // ← stays on a plain View, never on the Pressable
    alignItems: 'center',
  },
  iconTile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
});
```

**Symptoms that you've hit the bug:**

- Cards / rows render as a vertical column even though your code says `flexDirection: 'row'`
- Backgrounds and borders that look correct in code don't appear on screen
- The bundler is clean — no warnings
- It happens *only* in production-like reloads, not always in fast-refresh

**Prevention:** if a component must use `flexDirection: 'row'`, route it through a `View` inside the Pressable, not the Pressable's own style. Same for any custom border / background you depend on. Pressable's functional `style` is fine for purely visual press feedback (like a 3% darken on press) — just keep it away from layout.

### Card press recipe

For tappable cards (rounded surface with its own background + border, e.g. dashboard active batches, list cards):

```jsx
import { StyleSheet, Pressable, View } from 'react-native';

const {
  dark, accentColor, elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
} = useHeroSheetTokens();

<Pressable
  onPressIn={() => Haptics.selectionAsync().catch(() => {})}
  onPress={handlePress}
  android_ripple={{
    color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderless: false,
  }}
  style={({ pressed }) => [
    styles.card,
    {
      backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
      borderColor: pressed ? accentColor : elevatedCardBorder,
      transform: [{ scale: pressed ? 0.985 : 1 }],
      opacity: pressed ? 0.95 : 1,
    },
  ]}
>
  <View style={styles.cardRow}>{/* card content */}</View>
</Pressable>

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 12, borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
```

> Note the layout (`borderRadius`, `padding`, `borderWidth`, AND the inner `flexDirection: 'row'`) lives in `StyleSheet`, not inside the functional press-style. The functional style is only used for the press-state *visual* deltas (background, border colour, scale, opacity). This avoids the "card collapses to column" bug — see the trap warning above.

Why these specific shifts:
- **Use the elevated tokens, never `inputBg` or `sectionBg`.** Cards stacked inside a `SheetSection` need to read as one layer above their host. `elevatedCardBg` is +6% L over `sectionBg` in dark mode and ~5% darker than `sheetBg` in light mode, which is the smallest gap that survives a tinted surface in both themes.
- **Tint, not lift.** The card stays on the page — no shadow change — but the surface itself reads "I am being touched." Background tint + accent border do the heavy lifting on iOS; the ripple does the same job on Android.
- **`scale: 0.985`** is the smallest scale that's perceivable on a 60Hz display; anything more aggressive starts to feel toy-like at the dashboard density.
- **Haptic on `onPressIn`** so the user feels the response *before* navigation triggers — matches iOS Maps / Photos / Health behaviour.

---

## 10. Iconography

- Library: **lucide-react-native** (already a dep).
- Stroke width: **2.0** by default, **2.2–2.4** when small (≤16pt) or on tinted tiles, **3** for `Check` glyphs.
- Sizes:
  - Inline label icon: **13pt**
  - Settings row tile icon: **16pt**
  - Input field icon: **18pt**
  - Hero icon tile: **26pt**
  - Status pill icon: **10–12pt**
- Color: always pass `iconColor` from `useHeroSheetTokens()`, the `accentColor` for active states, the entity's own color for module/category cards, or a hardcoded white when on the hero gradient.

---

## 11. Imagery

- Hero banner: full white version `banner-white.png` always wins on the gradient (never use the green wordmark on the gradient — it disappears).
- App logo: square gear+chicken `logo.png` / `logo-white.png` — use only when there's a clean white tile background to set it on.
- Avatars: prefer initials in a white tile with `Poppins-Bold`, primary green text. Only swap in a real photo if the user has uploaded one.

### Flags

For language pickers and any other locale-tied surface, use the inlined SVG flag components in [`mobile/components/flags/`](../components/flags/):

```jsx
import FlagTile, { getFlagComponent } from '@/components/flags';

// In a row / pill / list item
<FlagTile code="en" size={28} />          // → United States flag, rounded 28pt tile
<FlagTile code="ar" size={16} radius={3} />  // → Arabic-language flag, smaller and tighter

// Conditional fallback (when a code might not have a flag yet)
const Flag = getFlagComponent(lang.code);
{Flag ? <FlagTile code={lang.code} /> : <CodeBadge code={lang.code} />}
```

**Conventions:**

- **Flags are inlined as React components** using `react-native-svg` primitives — no `react-native-svg-transformer` needed. Each flag is a small `<Svg>` with `<Path>` / `<Rect>` / `<Use>` children. Crisp at any size, tints if needed, ~50 lines per flag.
- **`FlagTile` always wraps the SVG in a clipped rounded `View`** (radius defaults to ~`size * 0.18`) plus a 0.5pt hairline border, so flags from different aspect ratios sit comfortably together in a list row or pill.
- **Use the language's flag, not a country's, for non-country-bound locales.** Arabic uses the Arabic-language flag (`ArabicFlag.js`, green field with white "لغة" calligraphy), not Saudi or UAE — Arabic isn't tied to a single country and using a country flag would be misleading. English uses the US flag because that's the most universally recognised English-speaking standard for this product.
- **Adding a new language:** drop a `<LangCode>Flag.js` file into `mobile/components/flags/`, add it to the `FLAG_BY_CODE` map in [`mobile/components/flags/index.js`](../components/flags/index.js), and append the language to `SUPPORTED_LANGUAGES` in [`mobile/i18n/index.js`](../i18n/index.js). The `LanguageSelector` picks it up automatically.
- **`getFlagComponent(code)` returns `null` if no flag is registered.** Always check before assuming the flag exists, and gracefully fall back to a code badge (`EN`, `AR`, `FR`) so the list doesn't break when adding a new language ahead of its flag asset.

---

## 12. Right-to-left (RTL) — Arabic and beyond

Every screen in this language **must** render correctly in RTL. The product ships in markets where Arabic is the primary language (UAE / KSA), so RTL is a first-class requirement, not a polish item.

### How RTL gets enabled

1. The locale is detected by `expo-localization`'s `getLocales()[0]` (already wired in [`mobile/i18n/index.js`](mobile/i18n/index.js)).
2. When the resolved locale is `ar` (or any other RTL language), the app calls `I18nManager.allowRTL(true)` and `I18nManager.forceRTL(true)` **before** the first React render — typically inside `mobile/i18n/index.js` immediately after we know the language. A native restart is required for the flip to take effect, so we trigger `Updates.reloadAsync()` after the first toggle.
3. From that point on React Native's flexbox engine flips `flexDirection: 'row'` to physically render right-to-left automatically. **You don't need to do anything per-component for the basic flip — but you do need to follow the rules below or the layout will leak LTR assumptions.**

### Non-negotiable rules

#### 1. Use logical edges, not physical edges

In any inline style, JSX prop, or NativeWind class, **always** prefer the logical name. RN auto-flips logical properties; physical ones do not.

| ❌ Don't | ✅ Do |
|---|---|
| `marginLeft`, `marginRight` | `marginStart`, `marginEnd` |
| `paddingLeft`, `paddingRight` | `paddingStart`, `paddingEnd` |
| `borderLeftWidth`, `borderRightColor`, etc. | `borderStartWidth`, `borderEndColor`, etc. |
| `left: 8`, `right: 8` (absolute positioning) | `start: 8`, `end: 8` |
| Tailwind `ml-3`, `mr-2`, `pl-4`, `pr-4` | Tailwind `ms-3`, `me-2`, `ps-4`, `pe-4` |
| Tailwind `text-left` | Tailwind `text-start` |
| Tailwind `rounded-l-xl`, `rounded-r-xl` | Tailwind `rounded-s-xl`, `rounded-e-xl` |

`flexDirection: 'row'` and `gap` are already direction-neutral — you don't need to change those.

If a horizontal value really must stay on a specific physical side regardless of language (rare — usually only for visualizations like charts), wrap that decision in `I18nManager.isRTL` and write a comment explaining why.

#### 2. Mirror direction-implying icons

Lucide icons whose meaning depends on direction must mirror in RTL. The pattern:

```jsx
import { I18nManager } from 'react-native';
import { ChevronRight, ChevronLeft, ArrowLeft, ArrowRight } from 'lucide-react-native';

const isRTL = I18nManager.isRTL;
const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;
const BackArrow = isRTL ? ArrowRight : ArrowLeft;
```

The icons that **must** mirror:
- Navigation: `ArrowLeft`, `ArrowRight`, `ChevronLeft`, `ChevronRight`, `ChevronsLeft`, `ChevronsRight`
- Pagination: `SkipBack`, `SkipForward`, `Rewind`, `FastForward`
- Lists / outdent: `IndentDecrease`, `IndentIncrease`, `AlignLeft`, `AlignRight`
- Send / share: `Send`, `Reply`, `LogIn`, `LogOut`, `ArrowLeftRight` (always mirrors)
- Trends: `TrendingUp` does not mirror (the up-and-to-the-right semantics are universal)

The icons that **must NOT** mirror (their glyph carries fixed meaning):
- Brand logos (Github, X, etc.)
- Numeric / clock glyphs (`Clock`, `Calendar`, `Hash`, `Percent`)
- Universal symbols (`Check`, `X`, `Plus`, `Minus`, `Search`, `Home`, `Settings`)
- Audio (`Play`, `Pause`, `Volume`)

When in doubt: if the icon implies "forward/back" or "next/previous", mirror it.

#### 3. Text alignment defaults to start, not left

For a single-language layout, `textAlign: 'left'` *looks* fine in both directions because RN's default is `start`. But the moment you set `textAlign: 'left'` explicitly, you have hardcoded LTR. **Always use `'start'` or `'end'`** unless you have a specific reason (e.g. a number column that should always right-align numerically).

For multi-script paragraphs that may contain both LTR (English brand names, numbers) and RTL text inside a single `<Text>`, set `writingDirection: 'rtl'` on the parent `<Text>` so the iOS bidi algorithm groups runs correctly. Without it, English chunks inside an Arabic paragraph float to whichever side they were rendered.

```jsx
<Text style={{ writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr', textAlign: 'start' }}>
  {address.street}
</Text>
```

#### 4. Numbers, currency, and dates

**Numbers stay in Western digits — always.** We never translate numerals into Arabic-Indic (٠١٢٣٤٥٦٧٨٩), Persian, Bengali, or any other script. This is a product decision: counts, money, percentages, dates, IDs, and any tabular value must be readable identically across every language so finance, ops, and support teams can sanity-check data without context-switching. The only thing that translates around a number is the **label** beside it.

| Use case | Rule |
|---|---|
| Numbers | `Number(val).toLocaleString('en-US', { ... })`. Always pass `'en-US'` (or a constant like `NUMERIC_LOCALE`) — never `i18n.language`, never `undefined`. Western digits, comma thousands separator, period decimal in every locale. |
| Currency amount | `new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)` for the number, then render the currency code as a separate `<Text>` so the symbol's side and font can be tuned independently. The hand-concatenated `${currency} ${amount}` form is fine as long as both halves are rendered LTR — wrap the line in a `<View style={{ flexDirection: 'row', writingDirection: 'ltr' }}>` if it sits inside an Arabic paragraph so it doesn't reorder. |
| Percentages | `${value.toFixed(2)}%`. The `%` glyph stays on the trailing side; don't localise it. |
| Dates with month names | `new Date().toLocaleDateString(i18n.language, opts)` so the month name and weekday translate, but the **digits inside the date stay Western** because `toLocaleDateString` for `ar` would otherwise emit Arabic-Indic. If the formatter starts emitting non-Western digits in any locale, switch to building the date manually: `${pad(day)} ${MONTHS[i18n.language][month]} ${year}` with a Western-digit `pad()`. |
| Pure-digit dates (timestamps, ISO) | `'en-US'` locale. e.g. `new Date().toLocaleDateString('en-US')` → `4/17/2026`. Never the user's locale. |
| Mixed strings (e.g. "Day 17 of 35") | Use i18n interpolation with named placeholders: `t('dashboard.dayOfTarget', { day, target })`. Translators reorder the surrounding text freely; the *number values* you pass in stay as raw JS numbers (which i18next renders verbatim — no locale digit conversion). |
| Tabular numerals | Keep `tabular-nums` / `fontVariant: ['tabular-nums']` so columns align across every screen and language. |

Concrete pattern for a "currency amount" cell that we use in the dashboard heroes, accounting filter bar, etc.:

```jsx
// At the top of any file that renders amounts:
const NUMERIC_LOCALE = 'en-US';
const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Render:
<View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
  <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 30 }}>{currency}</Text>
  <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 30 }}>{fmt(amount)}</Text>
</View>
```

This keeps the **layout** RTL-aware (the row flips with the language so the currency code lands on the leading side) while the **glyphs themselves** never change script.

#### 5. Hero gradient direction

The 3-stop diagonal flips with the language. Set the gradient's `start`/`end` based on `I18nManager.isRTL` so the bright corner stays on the *leading* side (top-leading), not always top-left:

```jsx
const isRTL = I18nManager.isRTL;
<LinearGradient
  colors={heroGradient}
  start={{ x: isRTL ? 1 : 0, y: 0 }}
  end={{ x: isRTL ? 0 : 1, y: 1 }}
  ...
/>
```

#### 6. Sheets, swipes, and gestures

- Bottom-sheet swipe-to-dismiss is vertical — direction-neutral, no change needed.
- `PagerView` swipe-back from a tab is horizontal and must respect RTL: in Arabic the previous tab is on the *right*. `react-native-pager-view` handles this automatically *if* `I18nManager.isRTL` was set before mount; if you see tabs scrolling backwards, that's a sign you toggled RTL after the pager initialised.
- Custom gesture handlers (`Gesture.Pan().onEnd(...)`) that branch on `event.translationX > N`: invert the sign when RTL, or you'll register "swipe forward" as "swipe back."

#### 7. Fonts

Poppins ships only Latin glyphs — Arabic text falls back to the system font, which clashes with the brand. The pairing we use:

- Latin script → **Poppins** (existing — `Poppins-Regular`, `Poppins-Medium`, `Poppins-SemiBold`, `Poppins-Bold`)
- Arabic script → **Cairo** (sibling of Poppins, same weights, geometrically aligned)

Load both font families via `useFonts` and resolve at the `<Text>` style level by checking the language:

```jsx
const arabic = i18n.language?.startsWith('ar');
const family = arabic ? 'Cairo-SemiBold' : 'Poppins-SemiBold';
```

A future PR will add a `useBrandFont(weight)` hook so individual screens don't repeat this branching.

#### 8. RTL-safe asset variants

When an asset has direction baked in (an arrow inside an illustration, a stamp shape pointing left), ship a `*_rtl.png` companion and pick at use site:

```jsx
const src = I18nManager.isRTL
  ? require('@/assets/images/banner-white_rtl.png')
  : require('@/assets/images/banner-white.png');
```

The PoultryManager logo and banner are direction-neutral — no RTL variants needed.

### Per-pattern checklist

Before merging any screen, walk through this list mentally:

- [ ] No `marginLeft` / `paddingRight` / `left:` / etc. anywhere — only `Start` / `End` variants.
- [ ] All chevrons and arrows mirror.
- [ ] All `textAlign` is `'start'` or `'end'` (or a deliberate exception with a comment).
- [ ] All numbers, money amounts, percentages, and pure-digit dates render in **Western digits**. Every `toLocaleString` / `Intl.NumberFormat` / `toLocaleDateString` call passes `'en-US'` (or the `NUMERIC_LOCALE` constant) — never `i18n.language`, never `undefined`. Verify by switching the device to Arabic and confirming you still see `1,234.56`, not `١٬٢٣٤٫٥٦`.
- [ ] All composite strings come from i18n with named placeholders, never `${a} ${b}` concatenation.
- [ ] If the screen has a hero gradient, the `start`/`end` props branch on `I18nManager.isRTL`.
- [ ] If the screen has a horizontal gesture, the `translationX` math branches on `I18nManager.isRTL`.
- [ ] Smoke test by toggling `I18nManager.forceRTL(true)` and reloading. Both languages must look intentional, not "the same screen mirrored."

### What's already wrong (audit backlog)

The codebase pre-dates this rule. Known offenders to fix as we revisit each screen:
- All `mr-*` / `ml-*` / `pl-*` / `pr-*` Tailwind classes (mostly Settings rows, sheet headers, FAB positioning).
- All `marginRight`/`marginLeft` inline styles in dashboard widgets, list rows, hero badges.
- Every literal `<ChevronRight>` used as an "open detail" affordance.
- Hardcoded `${currency} ${amount}` in `BroilerKpiHero`, `ContactDetail`, `WorkerDetail`, the accounting views.
- `LinearGradient` `start`/`end` props in `HeroSheetScreen` (currently fixed at `{ 0, 0 }` → `{ 1, 1 }`).
- **Every existing `toLocaleString(undefined, ...)` call** — `BroilerActiveBatches`, `BroilerKpiHero`, `AccountingFilterBar`, `FeedOrdersListView`, `SourcesListView`, `TransfersListView`, `SalesListView`, `ExpensesListView`, both list cards, both detail screens. Ship a `NUMERIC_LOCALE = 'en-US'` constant in a shared util (`mobile/lib/format.js`) and replace every site in one pass.

When you touch any of those files for an unrelated change, fix the RTL issues in the same PR.

---

## 13. Don'ts

- ❌ Don't use a `<Card>` component inside `HeroSheetScreen` — use `SheetSection` instead. `<Card>` was the previous design language; mixing them looks like two different apps.
- ❌ Don't add bordered `<Input>` fields. Use `SheetInput`.
- ❌ Don't render screen-level navigation chrome (custom headers, "Back" text buttons) outside the hero. The hero IS the chrome.
- ❌ Don't put the brand green button on top of the hero gradient. The CTA always lives in the sheet.
- ❌ Don't round the bottom corners of the gradient — the sheet's rounded top covers them and the leftover curves look like wings on the sides.
- ❌ Don't introduce ad-hoc colors. If you need a new state color, add it to `useHeroSheetTokens` first.
- ❌ Don't use Alert / native dialogs for confirmation that has more than one consequence — prefer a section card with explicit primary/destructive buttons.
- ❌ Don't animate the gradient or the sheet on mount. The pattern's strength is its calm.
- ❌ Don't wrap `HeroSheetScreen` in your own `<ScrollView>` (or render the hero inside one). The hero must stay anchored at the top of the safe area — see the "Critical scroll rule" in §1. If you need scrollable content, leave `scrollable` on (the default); the sheet handles it internally.
- ❌ Don't add `paddingHorizontal` to `HeroSheetScreen`'s `contentStyle` when the sheet contains `SheetSection`s. Sections own the gutter (16pt margin-horizontal). Adding screen-level padding doubles up to 32pt+ and makes the page look hollow. See §4 "CRITICAL — sheet content gutter rule" for the recipes.
- ❌ Don't leave `padded={true}` (the default) on a `SheetSection` whose children are already padded card rows (settings rows, module picker rows, etc). The section's 16pt padding stacks with the row padding, ringing each row in dead space. Use `padded={false}`.
- ❌ Don't use physical edges (`marginLeft`, `paddingRight`, `left:`, `ml-*`, `pr-*`, `text-left`). Use the logical equivalents (`marginStart`, `paddingEnd`, `start:`, `ms-*`, `pe-*`, `text-start`) so the layout flips correctly in Arabic. See §12.
- ❌ Don't render `<ChevronRight>` / `<ArrowLeft>` literally as a navigation affordance — pick the icon based on `I18nManager.isRTL`. See §12.
- ❌ Don't hand-concatenate composite text strings (`Day ${n} of ${target}`, `${count} selected`, `${shown} of ${total}`). Use i18n named placeholders so translators reorder the surrounding words around the raw numbers. See §12.
- ❌ Don't translate digits. Numbers, percentages, money, IDs, and any tabular value must always render in Western digits (0-9), regardless of locale. Pass `'en-US'` (or the shared `NUMERIC_LOCALE` constant) to every `toLocaleString` / `Intl.NumberFormat` / `toLocaleDateString` call. Never `i18n.language`, never `undefined`. See §12.4.
- ❌ Don't put `flexDirection`, `borderWidth`, `borderColor`, `backgroundColor`, or any other layout-bearing style inside `Pressable`'s functional `style={({ pressed }) => ({...})}`. NativeWind's `react-native-css-interop` silently strips them and your row collapses to a vertical column. Hoist layout into `StyleSheet.create`, put `flexDirection: 'row'` on a plain inner `<View>`, and reserve the functional style for press-state colour/scale deltas only. See §9 "NativeWind / Pressable functional-style trap" for the recipe.
- ❌ Don't roll your own modal + list for "pick X from a list" flows. Use `BottomPickerSheet` (or `Select` if it's a form). They handle the swipe, keyboard, search, header, animation, and RTL for free. See §6.
- ❌ Don't use a country flag for a non-country-bound locale. Arabic uses the Arabic-language flag, not Saudi/UAE. See §11 "Flags."

---

## 14. Reference implementations

Look at these files first when building a new screen:

| File | Why look here |
|---|---|
| `mobile/app/(auth)/login.js` | Brand hero, custom inputs, segmented divider, trust badge |
| `mobile/app/(app)/(tabs)/settings.js` | User-identity hero, settings rows, segmented control, destructive logout |
| `mobile/app/(app)/settings-modules.js` | Icon-tile hero with header-right pill, status pills, entity-colored cards |
| `mobile/app/(app)/settings-profile.js` | Form-heavy screen with multiple sections, sub-section dividers |
| `mobile/app/(app)/settings-accounting.js` | Form with `Select` dropdowns, read-only auto-filled fields |
| `mobile/app/(app)/settings-sale-defaults.js` | Two-column dense input grid |
| `mobile/app/(app)/(tabs)/dashboard.js` | Time-aware hero, hero toolbar (module switcher + sync), pull-to-refresh, quick-stats pulse strip |
| `mobile/modules/broiler/dashboard/BroilerKpiHero.js` | Headline-data SheetSection cards, scope segmented filter, semantic colors driven by tokens |
| `mobile/modules/broiler/dashboard/BroilerActiveBatches.js` | Stack of tappable mini-cards inside a `padded={false}` section |
| `mobile/components/HeroSheetScreen.js` | The layout primitive + token hook + the `scrollableHero` opt-in mode used by the dashboard |
| `mobile/components/SheetSection.js` | Section card primitive |
| `mobile/components/SheetInput.js` | Input + currency input primitive |
| `mobile/components/BottomPickerSheet.js` | Swipeable bottom-sheet primitive (search, animations, pan responder, ref API) |
| `mobile/components/ui/Select.js` | Form-grade thin wrapper over `BottomPickerSheet` (default trigger + Add New + Clear) |
| `mobile/components/ui/DatePicker.js` | Form-grade single-date picker (compact trigger + bottom-sheet calendar) |
| `mobile/components/ui/DateRangePicker.js` | Bottom-sheet contiguous start→end range picker with quick-range chips |
| `mobile/components/LanguageSelector.js` | Hero-pill trigger + `BottomPickerSheet` with custom flag-based `renderItem` — canonical "non-form picker" example |
| `mobile/components/flags/index.js` | `FlagTile` component + `getFlagComponent(code)` resolver; how to add a new locale flag |
| `mobile/components/SyncIconButton.js` | Canonical **hero-icon popout floater** (§8.h.1) — translucent trigger + Modal-anchored popover with `measureInWindow` + spring `Easing.back(1.4)` animation. Use this exact pattern for any future "hero icon → quick panel" flow |
| `mobile/components/FullResyncOverlay.js` | Canonical **progress overlay** (§8.h) — non-dismissable, brand-tinted backdrop, accent-tinted big icon tile, accent progress bar |

### Widget quick-stats contract (dashboard pulse strip)

The dashboard's `heroBelow` slot can render up to three pills sourced from the **active module**. To opt in, a module exports a hook on its registry entry:

```js
// modules/<id>/index.js
export default {
  // …
  useDashboardQuickStats: useMyModuleQuickStats,
};
```

The hook receives `{ currency, t }` and returns:

```ts
type QuickStat = {
  key: string;                     // unique within the row
  icon: LucideIcon;                // 13pt white icon shown left of the value
  label: string;                   // small secondary label, lowercase by convention
  value: string;                   // pre-formatted, compact (e.g. "AED 12.4K")
  accent?: 'positive' | 'negative' | 'warning';  // reserved for future styling
};

type Result = QuickStat[] | null | [];   // null = loading; [] = no data; array = render
```

Rules:
- **Always call hooks unconditionally** — the dashboard installs the active module's hook into a single slot, so React's rules are respected.
- **Cap at 3 stats**; the strip wraps but anything beyond 3 starts to look noisy.
- **Use compact formatting** (`12.4K`, `1.2M`) so pills don't blow out at narrow widths.
- **Reuse the same data layer** as your widgets (e.g. a shared `useXxxDashboardStats` hook). `useLocalQuery` dedupes results internally so it's free to call again.

Reference: [`mobile/modules/broiler/dashboard/broilerQuickStats.js`](../modules/broiler/dashboard/broilerQuickStats.js).

---

## 15. Quick recipe — building a new screen

1. **Wrap with `<HeroSheetScreen>`.** Pick a hero pattern from §7.
2. **Add a `heroExtra`** — icon tile (sub-pages), avatar (identity hero), banner (auth), or time-of-day icon (dashboard).
3. **Add `headerRight`** if there's a relevant pill (count, currency, role) or toolbar (module switcher + sync).
4. **Group all content into `<SheetSection>`s** with uppercase eyebrow titles.
5. **Use `SheetInput`** for every text field. The section's built-in 16pt padding handles room; pass `padded={false}` for row-based content.
6. **For "pick X from a list" flows, use `BottomPickerSheet`** (or `Select` if the trigger is a form field). Never roll your own modal + list. See §6.
7. **For tappable cards or rows, follow the `StyleSheet` rule.** Layout (`flexDirection: 'row'`, `borderWidth`, etc.) lives in `StyleSheet.create` and on a plain inner `<View>`, NOT on Pressable's functional `style={({ pressed }) => ({...})}`. The functional style is reserved for press-state colour/scale deltas. See §9 "NativeWind / Pressable functional-style trap."
8. **End with the primary CTA** — `Button` with `size="lg"` + `className="w-full rounded-2xl"` + white text.
9. **Pull all colors from `useHeroSheetTokens()`** — never hardcode hex.
10. **Add haptics** to every press (`Haptics.selectionAsync()` on `onPressIn`).
11. **Test in both themes.** Verify each layer is visibly distinct from the one below it.
12. **Test in RTL.** Toggle the language selector to العربية — every chevron should flip, every margin should mirror, every composite string should still read naturally. See §12 for the full checklist.
