package main

import (
	"testing"
)

// body: binding and validating a request body, at two sizes and two refusals.
//
// Where the five Go targets stop agreeing. Each reaches a different validation facility, and
// the two refusals are judged as envelopes because what a framework answers when a body is wrong
// is its own contract, not this repository's.

// rb:test body.bind_small
func TestASmallBodyBinds(t *testing.T) {
	a := planFor("body.bind_small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test body.bind_medium
func TestAMediumBodyBinds(t *testing.T) {
	a := planFor("body.bind_medium")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test body.validate_small
func TestASmallBodyThatIsValidPassesValidation(t *testing.T) {
	a := planFor("body.validate_small")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test body.validate_medium
func TestAMediumBodyThatIsValidDoesToo(t *testing.T) {
	a := planFor("body.validate_medium")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test body.rejected_all
func TestABodyFailingThreeRulesIsRefused(t *testing.T) {
	a := planFor("body.rejected_all")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}

// rb:test body.rejected_first
func TestABodyFailingOneRuleIsRefusedTheSameWay(t *testing.T) {
	a := planFor("body.rejected_first")

	got := sendPlanned(a)

	assertEnvelope(t, a, got, suiteTarget)
}
