package main

import (
	"testing"
)

// parameters: route capture, at zero, one and two segments.
//
// The captured values do not reach the answer. The payload is the shared one, so what these
// hold is that the route matched at all: a target whose two-segment pattern is wrong answers
// 404 and the floor says so on the status line before it ever looks at a body.

// rb:test parameters.static
func TestARouteWithNothingToCaptureMatches(t *testing.T) {
	a := planFor("parameters.static")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test parameters.one
func TestOneCapturedSegmentMatches(t *testing.T) {
	a := planFor("parameters.one")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test parameters.two
func TestTwoCapturedSegmentsMatch(t *testing.T) {
	a := planFor("parameters.two")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
