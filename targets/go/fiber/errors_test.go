package main

import (
	"testing"
)

// errors: the three refusals that are nobody's fault but the request's.
//
// All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
// the framework rather than the handler: nothing registers that path, so what answers is
// whatever the target does with a route it does not have.

// rb:test errors.not_found
func TestARegisteredRouteWithNoSuchRowAnswers404(t *testing.T) {
	a := planFor("errors.not_found")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}

// rb:test errors.unmatched
func TestAPathNothingRegistersAnswersTheFrameworksOwn404(t *testing.T) {
	a := planFor("errors.unmatched")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONAtAllIsRefused(t *testing.T) {
	a := planFor("errors.malformed")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}
