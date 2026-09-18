package main

import (
	"testing"
)

// etag: the validator a target computes, and what it does when one comes back.
//
// The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
// the target has answered a different one, because the validator is the target's to produce.

// rb:test etag.small
func TestTheSmallResponseCarriesAValidator(t *testing.T) {
	a := planFor("etag.small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Headers.Get("ETag") == "" {
		t.Fatal("no etag")
	}
}

// rb:test etag.large
func TestSoDoesTheLargeOne(t *testing.T) {
	a := planFor("etag.large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Headers.Get("ETag") == "" {
		t.Fatal("no etag")
	}
}

// rb:test etag.match_large
func TestAValidatorTheTargetJustIssuedIsAnsweredWith304(t *testing.T) {
	a := planFor("etag.match_large")

	got := sendAfterCapture(a)

	assertFloor(t, a, got)
	// Fiber sends content-type: application/json; charset=utf-8 on this 304. RFC 9110 15.4.5 says a
	// server SHOULD NOT send representation metadata on one, and spec/expected.json leaves
	// it unpinned because the frameworks disagree, so this test does not hold Fiber to it.
}

// rb:test etag.stale_large
func TestAValidatorTheTargetNeverIssuedIsAnsweredInFull(t *testing.T) {
	a := planFor("etag.stale_large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Headers.Get("ETag") == "" {
		t.Fatal("no etag")
	}
}
