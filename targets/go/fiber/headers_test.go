package main

import (
	"testing"
)

// headers: reading request headers, at a few and at many.
//
// The header count is the variable and the body is fixed, so a target that stopped reading
// headers at some limit would answer this correctly and still be wrong. What a response can
// hold is that the request was accepted with all of them attached, which is what these do.

// rb:test headers.few
func TestARequestCarryingAFewHeadersIsServed(t *testing.T) {
	a := planFor("headers.few")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test headers.many
func TestAndOneCarryingManyIsServedTheSameWay(t *testing.T) {
	a := planFor("headers.many")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
