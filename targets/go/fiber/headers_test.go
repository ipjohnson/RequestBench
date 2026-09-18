package main

import (
	"testing"
)

// headers: the request header map at five and at thirty headers, left unread and with three of
// them bound and echoed.
//
// /headers reads nothing and its body is fixed, so what few and many hold there is that the
// request was accepted with all of its headers attached. /headers/bind answers what it bound,
// and the plan reader fills the pinned echo with the values it drew, so the floor is an echo
// check: a header that came back missing, renamed or as a string where it was sent as an
// integer fails on the body.

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

// rb:test headers.bind_few
func TestThreeHeadersAreBoundAndEchoed(t *testing.T) {
	a := planFor("headers.bind_few")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}

// rb:test headers.bind_many
func TestAndTheSameThreeAmongThirty(t *testing.T) {
	a := planFor("headers.bind_many")

	got := sendPlanned(a)

	assertFloor(t, a, got)
}
