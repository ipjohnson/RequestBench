package main

import (
	"strings"
	"testing"
)

// baseline: the dispatch floor, with no serialization in the way.
//
// The one endpoint in the corpus that answers a literal. Its whole contract is the string
// and the content type, and the content type is the half a test gets wrong: a target that
// answers "Hello, World!" as application/json has passed the body and failed the endpoint.
// The floor checks the kind of body before the body for that reason.

// rb:test baseline.plaintext
func TestThePlaintextRouteAnswersALiteralAsText(t *testing.T) {
	a := planFor("baseline.plaintext")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if !strings.HasPrefix(got.ContentType, "text/plain") {
		t.Fatalf("content-type %q", got.ContentType)
	}
}
