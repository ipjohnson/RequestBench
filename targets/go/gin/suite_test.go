package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:test *
// The target, driven through net/http/httptest, which is what Gin's testing documentation
// uses: a request handed to the engine's ServeHTTP and a ResponseRecorder to catch the
// answer. No server and no socket, and the recorder holds the bytes the handler wrote, so a
// gzip body is still gzip when the floor reads it.
//
// It needed the target to change first. The engine was built inline in main(), so the only
// way to reach it was to start the target on its container port; router() builds it now and
// main() serves what it returns. TestMain loads the fixture, which main() does, before any
// test builds the engine.
var engine *gin.Engine

const suiteTarget = "go:gin"

func TestMain(m *testing.M) {
	readSpec()
	if err := d.Load(filepath.Join(specRoot, "spec", "fixture.json")); err != nil {
		panic(err)
	}
	engine = router()
	os.Exit(m.Run())
}

// sendPlanned sends one of an endpoint's planned requests.
func sendPlanned(a plannedRequest) answer {
	return sendWith(a, a.Headers)
}

func sendWith(a plannedRequest, headers map[string]string) answer {
	var body *strings.Reader
	if a.Body != nil {
		body = strings.NewReader(*a.Body)
	} else {
		body = strings.NewReader("")
	}
	req := httptest.NewRequest(a.Method, a.Path, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	r := w.Result()
	return answer{r.StatusCode, r.Header.Get("Content-Type"), r.Header.Get("Content-Encoding"),
		w.Body.Bytes(), r.Header}
}

// sendAfterCapture asks for the validator first, then sends the request that carries it.
func sendAfterCapture(a plannedRequest) answer {
	method, path, header := captureFor(a)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return sendWith(a, withCapture(a, w.Result().Header.Get(http.CanonicalHeaderKey(header))))
}

// rb:end
