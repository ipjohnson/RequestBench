package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

// rb:test *
// The target, driven through net/http/httptest and the Echo instance's own ServeHTTP.
//
// This is not what Echo's testing guide does. The guide builds a context with
// e.NewContext(req, rec) and calls a handler with it, and tests middleware by composing it by
// hand. That needs handlers a test can name, and this target registers closures inside its
// register functions; and it skips every route-scoped middleware, which is what the
// authorized, compressed, etag, cache and middleware families are made of, so a test written
// that way would pass while the layers it is about never ran. ServeHTTP goes through the
// router the target serves, which is httptest's shape and what the guide's handler-level test
// cannot reach. The guide also asserts with testify; this suite uses the standard library,
// because testify would be a new requirement in the go.mod all five Go targets share.
//
// The instance was built inline in main(); router() builds it now and main() serves what it
// returns. TestMain loads the fixture, which main() does, before building it.
var handler *echo.Echo

const suiteTarget = "go:echo"

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
