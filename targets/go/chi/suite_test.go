package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:test *
// The target, driven through net/http/httptest: a request handed to the router's ServeHTTP
// and a ResponseRecorder to catch the answer. chi has no testing guide of its own, and a chi
// router is an http.Handler, so this is the standard library's shape and needs nothing else.
// No server and no socket, and the recorder holds the bytes the handler wrote.
//
// The router was built inline in main(); router() builds it now and main() serves what it
// returns. TestMain loads the fixture, which main() does, before building it.
var handler *chi.Mux

const suiteTarget = "go:chi"

func TestMain(m *testing.M) {
	readSpec()
	if err := d.Load(filepath.Join(specRoot, "spec", "fixture.json")); err != nil {
		panic(err)
	}
	handler = router()
	os.Exit(m.Run())
}

// sendPlanned sends one of an endpoint's planned requests.
func sendPlanned(a plannedRequest) answer {
	return sendWith(a, a.Headers)
}

func sendWith(a plannedRequest, headers map[string]string) answer {
	body := strings.NewReader("")
	if a.Body != nil {
		body = strings.NewReader(*a.Body)
	}
	req := httptest.NewRequest(a.Method, a.Path, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	r := w.Result()
	return answer{r.StatusCode, r.Header.Get("Content-Type"), r.Header.Get("Content-Encoding"),
		w.Body.Bytes(), r.Header}
}

// sendAfterCapture asks for the validator first, then sends the request that carries it.
func sendAfterCapture(a plannedRequest) answer {
	method, path, header := captureFor(a)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return sendWith(a, withCapture(a, w.Result().Header.Get(http.CanonicalHeaderKey(header))))
}

// rb:end
