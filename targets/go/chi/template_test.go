package main

import (
	"strings"
	"testing"
)

// template: server-side HTML, at two sizes.
//
// The one family whose body is not compared byte for byte. Five template engines cannot
// agree on formatting without every template being contorted to match, so the spec pins the
// content and leaves the whitespace free: same elements, same order, same values. The floor
// normalises both sides the way the conformance client does.

// rb:test template.small
func TestTheSmallTemplateRendersThePinnedContent(t *testing.T) {
	a := planFor("template.small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if !strings.HasPrefix(got.ContentType, "text/html") {
		t.Fatalf("content-type %q", got.ContentType)
	}
}

// rb:test template.medium
func TestTheMediumTemplateDoesToo(t *testing.T) {
	a := planFor("template.medium")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
