package unittests

import (
	"net/http"
	"testing"
)

// rb:test cache.small,cache.medium,cache.large
func TestASecondRequestForAKeyIsItsStoredAnswer(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"cache.small", "small"},
		{"cache.medium", "medium"},
		{"cache.large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			first := get(t, "/cache/"+row.size+"/k1")
			second := get(t, "/cache/"+row.size+"/k1")
			other := get(t, "/cache/"+row.size+"/k2")

			assertOK(t, payload(t, "items."+row.size+".json"), second)
			if serial(t, first) != serial(t, second) {
				t.Fatalf("serial %s then %s, so the handler ran twice", serial(t, first), serial(t, second))
			}
			if serial(t, other) == serial(t, first) {
				t.Fatal("k1 and k2 share one entry")
			}
		})
	}
}

// rb:test cache.vary_one
func TestOneVaryHeaderKeysTheStore(t *testing.T) {
	t.Run("cache.vary_one", func(t *testing.T) {
		alpha := serial(t, get(t, "/cache/vary/one/k1", "x-rb-tenant", "alpha"))
		beta := serial(t, get(t, "/cache/vary/one/k1", "x-rb-tenant", "beta"))

		if again := serial(t, get(t, "/cache/vary/one/k1", "x-rb-tenant", "alpha")); again != alpha {
			t.Fatalf("alpha answered %s, then %s", alpha, again)
		}
		if alpha == beta {
			t.Fatal("alpha and beta share one entry")
		}
	})
}

// rb:test cache.vary_many
func TestEachOfThreeVaryHeadersKeysTheStore(t *testing.T) {
	t.Run("cache.vary_many", func(t *testing.T) {
		webEuAlpha := []string{"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "alpha"}
		webEuBeta := []string{"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "beta"}

		response := get(t, "/cache/vary/many/k1", webEuAlpha...)
		first := serial(t, response)

		assertOK(t, payload(t, "items.small.json"), response)
		if again := serial(t, get(t, "/cache/vary/many/k1", webEuAlpha...)); again != first {
			t.Fatalf("web, eu, alpha answered %s, then %s", first, again)
		}
		if serial(t, get(t, "/cache/vary/many/k1", webEuBeta...)) == first {
			t.Fatal("alpha and beta share one entry")
		}
	})
}

func TestTheAnswerSaysWhatItVariesOn(t *testing.T) {
	response := get(t, "/cache/vary/many/k1")

	assertStatus(t, response, http.StatusOK)
	if vary := response.Header.Get("Vary"); vary != "x-rb-channel, x-rb-region, x-rb-tenant" {
		t.Fatalf("vary %q", vary)
	}
}
