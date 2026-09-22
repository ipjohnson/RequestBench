// The six-hue categorical set, as values.
//
// styles/tokens.css holds the same six as --s0..--s5. The charts need them as strings,
// because an SVG stroke is written per path and reading a custom property back out of the
// document is a layout read per line. Changing one means changing the other, which is what
// the test in test/html.test.ts checks.
export const SERIES_LIGHT = ["#00836E", "#B5651D", "#3F6FB0", "#A03E5C", "#6B8E23", "#7D5BA6"];
export const SERIES_DARK = ["#2E9B85", "#C77A2A", "#5A85C4", "#C05A78", "#7FA03A", "#9478BE"];
