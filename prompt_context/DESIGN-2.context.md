# Context: DESIGN-2.md

## What it does
Defines a complete visual design system for the project with a Digital Print / modernist editorial aesthetic. It specifies color tokens, typography, spacing, layout rules, component styling, and strict visual constraints.

## Exports / Public surface
- `colors`: design tokens for surfaces, text hierarchy, accent, semantic tones, and state colors; intended for UI theming values.
- `typography`: text style tokens (display, headings, body, mono labels/code, quotes) including font family, size, weight, line-height, and letter spacing.
- `spacing`: layout scale tokens for page padding, gutters, rule weights, and vertical rhythm stacks.
- `Brand & Style` guidance: defines the overall visual philosophy and emotional tone.
- `Colors` guidance: explains practical usage rules for neutrals, ink hierarchy, accent, and semantic color semantics.
- `Typography` guidance: assigns roles for Instrument Serif, Inter, and JetBrains Mono.
- `Layout & Spacing` guidance: establishes fixed-page handbook framing, running heads/feet, and divider logic.
- `Elevation & Depth` guidance: prohibits shadows and defines flat-depth alternatives via tonal layering and borders.
- `Shapes` guidance: enforces rectangular geometry and zero border radius.
- `Components` guidance: rules for buttons, cards, inputs, lists, running heads/feet, and metadata tags.

## What it does NOT do
- Does not define app feature flows, user journeys, or backend/system architecture.
- Does not provide page-specific content for a one-page summary handout.
- Does not include iconography rules, illustration style packs, or chart libraries.
- Does not define print-production settings (bleed, CMYK profiles, export resolution).
- Does not contain implementation code for generating a visual one-pager automatically.

## Constraints and edge cases
- Enforces a fixed 8.5x11 page metaphor and running header/footer treatment.
- Strongly restricts visual style: no shadows, no rounded corners, high rule/border consistency.
- Accent color usage is intentionally sparse and should be reserved for high-importance elements.
- Mono typography is expected for metadata/system labels, generally uppercase for labels.
- Hierarchy is expected to be conveyed via grid, typography, and thin rules rather than card effects.

## Last read
2026-05-08 - DESIGN-2.md
