package main

import (
	"testing"
)

// domain: the eight operations that reach the shared model, including the four that write.
//
// The largest family and the one where a handler is doing something rather than returning
// something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
// with no body are both answers a framework can get subtly wrong while returning the right
// status, which is why the floor checks the kind of body even when there is none.

// rb:test domain.lookup
func TestOneOrderIsLookedUp(t *testing.T) {
	a := planFor("domain.lookup")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.filter
func TestAFilteredListComesBack(t *testing.T) {
	a := planFor("domain.filter")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.join
func TestAJoinAcrossTheModelComesBack(t *testing.T) {
	a := planFor("domain.join")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.aggregate
func TestAnAggregateIsComputed(t *testing.T) {
	a := planFor("domain.aggregate")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.create
func TestACreatedOrderAnswers201(t *testing.T) {
	a := planFor("domain.create")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.replace
func TestAReplacedCustomerAnswersTheNewState(t *testing.T) {
	a := planFor("domain.replace")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.patch
func TestAPatchedCustomerAnswersTheMergedState(t *testing.T) {
	a := planFor("domain.patch")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test domain.delete
func TestADeletedLineAnswers204AndNoBody(t *testing.T) {
	a := planFor("domain.delete")

	got := sendPlanned(a)

	assertFloor(t, a, got)
	if len(got.Raw) != 0 {
		t.Fatalf("%d body bytes", len(got.Raw))
	}
}
