package implementation

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
)

// cacheRoutes replay a stored answer and skip the handler. Echo ships no response cache, so the
// store and the middleware in front of each route are written for it. The handler writes
// x-rb-serial, so a replayed answer repeats the serial it was stored with.
func cacheRoutes(e *echo.Echo, p *Payloads) {
	settings := p.Settings.Cache
	one := headerNames(settings.Vary.One)
	many := headerNames(settings.Vary.Many)
	// rb:wiring cache.*
	store := newStore(settings.Capacity, time.Duration(settings.TTLSeconds)*time.Second)

	e.GET("/cache/small", fresh(&p.Small), replay(store, nil))

	e.GET("/cache/medium", fresh(&p.Medium), replay(store, nil))

	e.GET("/cache/large", fresh(&p.Large), replay(store, nil))

	e.GET("/cache/vary/one", fresh(&p.Small), replay(store, one), varied(one))

	e.GET("/cache/vary/many", fresh(&p.Small), replay(store, many), varied(many))
}

// varied writes the Vary header, which tells a cache in front of the framework what the answer
// depends on. The store keys on the route's own list, not on this header.
func varied(names []string) echo.MiddlewareFunc {
	vary := strings.Join(names, ", ")
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			c.Response().Header().Set(echo.HeaderVary, vary)
			return next(c)
		}
	}
}

// rb:wiring cache.*
// replay answers from the store before the handler runs, and otherwise stores what the handler
// wrote. The key is the path and query, and the request headers the route varies on.
func replay(store *store, vary []string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			key := c.Request().URL.RequestURI()
			for _, name := range vary {
				key += "\n" + c.Request().Header.Get(name)
			}
			original := c.Response()
			if hit, ok := store.get(key); ok {
				header := original.Header()
				for name, values := range hit.header {
					header[name] = values
				}
				original.WriteHeader(hit.status)
				_, err := original.Write(hit.body)
				return err
			}
			copied := &copyingWriter{ResponseWriter: original}
			c.SetResponse(copied)
			err := next(c)
			c.SetResponse(original)
			if err == nil && copied.status == http.StatusOK {
				store.put(key, answer{http.StatusOK, original.Header().Clone(), copied.body.Bytes()})
			}
			return err
		}
	}
}

// copyingWriter sends what a handler writes and keeps a copy of it. Unwrap is how Echo finds its
// own Response under a writer a middleware installs.
type copyingWriter struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *copyingWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *copyingWriter) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *copyingWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

type answer struct {
	status int
	header http.Header
	body   []byte
}

type stored struct {
	answer
	expires time.Time
}

// store is one per process, sized in entries and aged by settings.json. A full store drops one
// entry to take another, whichever the map yields first.
type store struct {
	mu       sync.RWMutex
	entries  map[string]stored
	capacity int
	ttl      time.Duration
}

func newStore(capacity int, ttl time.Duration) *store {
	return &store{entries: make(map[string]stored, capacity), capacity: capacity, ttl: ttl}
}

func (s *store) get(key string) (answer, bool) {
	s.mu.RLock()
	entry, ok := s.entries[key]
	s.mu.RUnlock()
	if !ok || time.Now().After(entry.expires) {
		return answer{}, false
	}
	return entry.answer, true
}

func (s *store) put(key string, a answer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.entries[key]; !ok && len(s.entries) >= s.capacity {
		for evicted := range s.entries {
			delete(s.entries, evicted)
			break
		}
	}
	s.entries[key] = stored{a, time.Now().Add(s.ttl)}
}

// rb:end
