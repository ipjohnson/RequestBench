package main

import (
	"testing"
)

// query: parsing, percent-decoding and coercing query parameters, at one and at eight.
//
// The answer is the small payload with an echo of every value the target bound, and the
// values are drawn once per process, so the floor holds each of them as well as the status.
// A target that drops a parameter, coerces one wrong or leaves the %20 in q undecoded
// answers a different echo.

// rb:test query.one
func TestOneQueryParameterIsRead(t *testing.T) {
	a := planFor("query.one")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test query.many
func TestEightOfThemAreReadAndCoerced(t *testing.T) {
	a := planFor("query.many")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
