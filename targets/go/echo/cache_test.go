package main

import (
	"testing"
)

// cache: the framework's own response cache, and what it is keyed on.
//
// The vary rows are the ones worth having. A store keyed on fewer headers than it declares
// answers one tenant with another tenant's body, and that is a correctness failure a latency
// chart renders as a target that got faster.

// rb:test cache.small
func TestTheSmallCachedResponseIsWhatTheSpecPins(t *testing.T) {
	a := planFor("cache.small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test cache.medium
func TestTheMediumOneIsToo(t *testing.T) {
	a := planFor("cache.medium")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test cache.large
func TestAndTheLargeOne(t *testing.T) {
	a := planFor("cache.large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test cache.vary_one
func TestAResponseVaryingOnOneHeaderSaysSo(t *testing.T) {
	a := planFor("cache.vary_one")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test cache.vary_many
func TestAndOneVaryingOnThreeSaysAllThree(t *testing.T) {
	a := planFor("cache.vary_many")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
