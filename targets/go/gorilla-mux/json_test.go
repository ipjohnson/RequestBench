package main

import (
	"testing"
)

// json: serialization cost at three sizes, and nothing else in the path.
//
// The three differ only in how much there is to serialize, so there is nothing here a test
// can say that the floor does not already say better: the pinned body is the whole contract.
// What the three tests are for is the ratchet. An endpoint with no test is counted, and
// three that pass at three sizes is how a serializer that truncates the large one is caught.

// rb:test json.small
func TestTheSmallPayloadSerializesToWhatTheSpecPins(t *testing.T) {
	a := planFor("json.small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test json.medium
func TestTheMediumPayloadDoesToo(t *testing.T) {
	a := planFor("json.medium")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test json.large
func TestAndTheLargeOneWhichIsWhereATruncationWouldShow(t *testing.T) {
	a := planFor("json.large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
