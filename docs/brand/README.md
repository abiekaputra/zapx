# ZapX Brand System

## Core idea

ZapX makes an invisible delivery process inspectable. The mark turns that
product promise into one continuous angular path: a message enters, crosses a
controlled checkpoint, and remains traceable through its next attempt or final
outcome.

The opposing terminals also suggest retry and recovery without using a literal
envelope, bell, or generic lightning icon. Its compact silhouette stays
recognizable in the browser favicon and the operations-console navigation.

## Visual language

- **Acid green (`#91FF68`)** represents active delivery state and operational
  signal.
- **Near-black (`#080A0B`)** is the console surface and the supporting cut in
  the mark.
- The symbol uses flat fields and strong negative space so it remains readable
  at 16, 24, and 32 pixels.
- The product name remains live text in the interface. This keeps the lockup
  accessible and avoids embedding generated typography in the asset.

## Files

- `zapx-mark.png` — 512 × 512 transparent primary mark used by GitHub and the
  product.
- `zapx-logo-preview.png` — light and dark presentation board with small-size
  checks.
- `apps/web/public/zapx-mark.png` — runtime copy used by the console and
  favicon.

## Generation and production treatment

The core symbol was created with OpenAI ImageGen as a purpose-built brand
asset. The selected concept was normalized after generation only to remove
low-alpha fringe pixels, lock the two production colors, add transparent clear
space, and export consistent sizes. The geometry was not reconstructed as an
SVG or CSS illustration.

### Selected ImageGen prompt

```text
Use case: logo-brand
Asset type: compact primary app icon for ZapX
Brand idea: ZapX is an operations product that turns an invisible notification
delivery process into a traceable sequence of attempts and outcomes. Create a
compact abstract emblem where one continuous angular path changes direction
twice, passes through one deliberate cut or checkpoint, and locks into a final
terminal shape. The meaning should be trace, speed, and controlled delivery.
The symbol may subtly suggest the rhythm of Z and X through negative space, but
must not literally draw either letter.
Style: top-tier identity design for developer infrastructure, reduced geometric
construction, confident asymmetry, strong negative space, memorable silhouette,
visually balanced at favicon scale
Composition: symbol only; compact near-square silhouette; centered; occupy 72
percent of a square transparent canvas; equal optical margins; no long
horizontal tail
Palette: exactly two solid flat fills, acid green #91FF68 as the dominant signal
color and near-black #080A0B as a supporting cut or field
Strict constraints: transparent background; hard vector-like edges; pure flat
fills; no gradients, shadows, glow, texture, noise, stray pixels, micro details,
circles, checkmark, envelope, bell, paper plane, standalone arrow, generic
lightning bolt, separate pasted shapes, typography, tagline, board, mockup,
watermark
Small-size test: the core idea must remain clear at 16x16 and 24x24 pixels and
be reproducible as a one-color silhouette
```

## Usage

- Preserve clear space equal to at least 12% of the mark width.
- Use the supplied transparent PNG without stretching, recoloring, shadows, or
  decorative containers.
- Keep the acid green version on near-black or another surface with equivalent
  contrast.
- Use the product name `ZapX` with the capital `Z` and `X`.
