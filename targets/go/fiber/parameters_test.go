package main

import (
	"testing"
)

// parameters: route capture at a constant depth of four segments, with none, one and two of
// them captured.
//
// Each capture is bound as an integer and echoed, and the plan reader fills the pinned echo
// with the values it drew, so the floor holds every capture to the number in the path. The
// static route binds nothing and answers the plain payload, so a capture route that took its
// request instead would come back with an echo the floor does not expect.

// rb:test parameters.static
func TestARouteWithNothingToCaptureMatches(t *testing.T) {
	a := planFor("parameters.static")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test parameters.one
func TestOneCaptureIsBoundAndEchoed(t *testing.T) {
	a := planFor("parameters.one")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test parameters.two
func TestTwoCapturesAreBoundAndEchoed(t *testing.T) {
	a := planFor("parameters.two")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
