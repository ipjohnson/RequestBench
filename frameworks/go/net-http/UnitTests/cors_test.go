package unittests

import (
	"net/http"
	"regexp"
	"testing"
)

const origin = "https://shop.example.com"

// rb:test cors.preflight
func TestTheWrapperAnswersAPreflightAlone(t *testing.T) {
	t.Run("cors.preflight", func(t *testing.T) {
		response := send(t, http.MethodOptions, "/cors/small", nil,
			"Origin", origin, "Access-Control-Request-Method", "GET", "Access-Control-Request-Headers", "x-rb-tenant")

		assertStatus(t, response, http.StatusNoContent)
		assertHeader(t, response, "Access-Control-Allow-Origin", origin)
		assertHeader(t, response, "Access-Control-Allow-Methods", "GET")
		assertHeader(t, response, "Access-Control-Max-Age", "600")
		if lists := regexp.MustCompile(`(?i)(^|,)\s*x-rb-tenant\s*(,|$)`); !lists.MatchString(response.Header.Get("Access-Control-Allow-Headers")) {
			t.Fatalf("allow headers %q", response.Header.Get("Access-Control-Allow-Headers"))
		}
		if response.Header.Get("x-rb-serial") != "" {
			t.Fatal("the handler ran for a preflight")
		}
	})
}

// rb:test cors.request
func TestTheRequestItselfReachesTheHandler(t *testing.T) {
	t.Run("cors.request", func(t *testing.T) {
		response := get(t, "/cors/small", "Origin", origin, "x-rb-tenant", "qwertyuiopas")

		assertHeader(t, response, "Access-Control-Allow-Origin", origin)
		serial(t, response)
		assertOK(t, payload(t, "items.small.json"), response)
	})
}

// rb:test cors.vary
func TestTheAnswerVariesByOrigin(t *testing.T) {
	t.Run("cors.vary", func(t *testing.T) {
		response := get(t, "/cors/small", "Origin", origin, "x-rb-tenant", "qwertyuiopas")

		if vary := regexp.MustCompile(`(?i)(^|,)\s*origin\s*(,|$)`); !vary.MatchString(response.Header.Get("Vary")) {
			t.Fatalf("vary %q", response.Header.Get("Vary"))
		}
	})
}

// rb:test cors.disallowed
func TestAnotherOriginGetsNoCorsHeaders(t *testing.T) {
	t.Run("cors.disallowed", func(t *testing.T) {
		response := send(t, http.MethodOptions, "/cors/small", nil,
			"Origin", "https://elsewhere.example.net", "Access-Control-Request-Method", "GET", "Access-Control-Request-Headers", "x-rb-tenant")

		assertStatus(t, response, http.StatusNoContent)
		assertNoHeader(t, response, "Access-Control-Allow-Origin")
		assertNoHeader(t, response, "Access-Control-Allow-Headers")
	})
}

// rb:test cors.scoped
func TestARouteOutsideCorsGetsNoAllowOrigin(t *testing.T) {
	t.Run("cors.scoped", func(t *testing.T) {
		response := get(t, "/json/small", "Origin", origin)

		assertStatus(t, response, http.StatusOK)
		assertNoHeader(t, response, "Access-Control-Allow-Origin")
	})
}

func TestAnOptionsRequestThatIsNotAPreflightReachesTheMux(t *testing.T) {
	response := send(t, http.MethodOptions, "/cors/small", nil, "Origin", origin)

	assertStatus(t, response, http.StatusMethodNotAllowed)
	assertHeader(t, response, "Access-Control-Allow-Origin", origin)
}

func assertHeader(t *testing.T, response *http.Response, name, want string) {
	t.Helper()
	if got := response.Header.Get(name); got != want {
		t.Fatalf("%s %q, want %q", name, got, want)
	}
}

func assertNoHeader(t *testing.T, response *http.Response, name string) {
	t.Helper()
	if got, ok := response.Header[http.CanonicalHeaderKey(name)]; ok {
		t.Fatalf("unexpected %s %q", name, got)
	}
}
