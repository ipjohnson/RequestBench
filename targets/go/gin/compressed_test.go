package main

import (
	"strings"
	"testing"
)

// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// The family a test client can quietly fail to reach. Where a target compresses inside the
// application an in-process client still runs the codec; where the compression belongs to the
// server underneath, no in-process client reaches it and the only honest test is one over a real port.
//
// The second trap is the client. Some of the clients here decode gzip before the body is
// read, so a test reading the decoded body would pass every assertion below against an identity
// response. The suite's own send says whether this one does.

// rb:test compressed.identity_small
func TestAClientThatWillNotTakeGzipIsAnsweredInFull(t *testing.T) {
	a := planFor("compressed.identity_small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Encoding != "" {
		t.Fatalf("content-encoding %q", got.Encoding)
	}
}

// rb:test compressed.identity_large
func TestTheLargePayloadIsUncompressedTooWhenIdentityWasAskedFor(t *testing.T) {
	a := planFor("compressed.identity_large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Encoding != "" {
		t.Fatalf("content-encoding %q", got.Encoding)
	}
}

// rb:test compressed.gzip_small
func TestAPayloadUnderTheSharedFloorIsGzippedAnyway(t *testing.T) {
	a := planFor("compressed.gzip_small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	// spec/expected.json pins no encoding here: the small payload sits under the shared
	// gzip floor and the frameworks disagree about what to do with it, and its unpinned
	// block records Gin as one that compresses. It does: 125 bytes into 128, three bytes more than it started with.
	if got.Encoding != "gzip" {
		t.Fatalf("content-encoding %q", got.Encoding)
	}
}

// rb:test compressed.gzip_large
func TestAPayloadOverTheFloorIsGzippedAndSaysWhatItVariesOn(t *testing.T) {
	a := planFor("compressed.gzip_large")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if got.Encoding != "gzip" {
		t.Fatalf("content-encoding %q", got.Encoding)
	}
	// Nothing in ASP.NET Core adds Vary for a response compressed by hand, so a target
	// that forgot it would pass the floor and be wrong in front of any shared cache.
	if !strings.Contains(strings.ToLower(got.Headers.Get("Vary")), "accept-encoding") {
		t.Fatalf("vary %q", got.Headers.Get("Vary"))
	}
}
