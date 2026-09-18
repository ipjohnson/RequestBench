package main

import (
	"testing"
)

// query: parsing and coercing query parameters, at one and at eight.
//
// The values never reach the answer, which is the point: this family is the parse and the
// coercion isolated from any use of them. A target that silently drops a parameter it cannot
// coerce answers the same body as one that read all eight, so what these hold is the status.

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
