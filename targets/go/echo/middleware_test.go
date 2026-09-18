package main

import (
	"testing"
)

// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// The layers are no-ops, so nothing they do is visible in a response and no assertion over
// one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
// practice: a test that calls the handler rather than the app passes while the layers never
// ran at all. The test host boots the application, so the layers are in the path here by
// construction, and that is the whole of what these three assert.

// rb:test middleware.none
func TestTheUnlayeredRouteAnswersTheSharedPayload(t *testing.T) {
	a := planFor("middleware.none")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test middleware.four
func TestFourLayersDoNotChangeTheAnswer(t *testing.T) {
	a := planFor("middleware.four")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test middleware.sixteen
func TestSixteenLayersDoNotChangeItEither(t *testing.T) {
	a := planFor("middleware.sixteen")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
