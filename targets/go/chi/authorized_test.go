package main

import (
	"testing"
)

// authorized: one endpoint that refuses, and one that does not.
//
// The pair is the test. A target that let everything through would pass the allowed case and
// nothing else, so the denial is what carries the family, and its envelope is the
// framework's own rather than this repository's.

// rb:test authorized.allowed
func TestARequestCarryingTheTokenIsServed(t *testing.T) {
	a := planFor("authorized.allowed")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test authorized.denied
func TestARequestWithTheWrongTokenIsRefusedInTheFrameworksOwnShape(t *testing.T) {
	a := planFor("authorized.denied")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}
