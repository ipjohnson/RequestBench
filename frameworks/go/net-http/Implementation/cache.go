package implementation

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"time"
)

// cacheRoutes replay a stored answer and skip the handler. net/http has no response cache, so the
// store and the handler wrapped around each route are written for it. The handler writes
// x-rb-serial, so a replayed answer repeats the serial it was stored with.
func cacheRoutes(mux *http.ServeMux, p *Payloads) {
	settings := p.Settings.Cache
	one := headerNames(settings.Vary.One)
	many := headerNames(settings.Vary.Many)
	// rb:wiring cache.*
	store := newStore(settings.Capacity, time.Duration(settings.TTLSeconds)*time.Second)

	mux.Handle("GET /cache/small", replay(store, nil, fresh(&p.Small)))

	mux.Handle("GET /cache/medium", replay(store, nil, fresh(&p.Medium)))

	mux.Handle("GET /cache/large", replay(store, nil, fresh(&p.Large)))

	mux.Handle("GET /cache/vary/one", replay(store, one, varied(one, fresh(&p.Small))))

	mux.Handle("GET /cache/vary/many", replay(store, many, varied(many, fresh(&p.Small))))
}

// varied writes the Vary header, which tells a cache in front of the framework what the answer
// depends on. The store keys on the route's own list, not on this header.
func varied(names []string, next http.Handler) http.Handler {
	vary := strings.Join(names, ", ")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Vary", vary)
		next.ServeHTTP(w, r)
	})
}

// rb:wiring cache.*
// replay answers from the store before the handler runs, and otherwise stores what the handler
// wrote. The key is the path and query, and the request headers the route varies on.
func replay(store *store, vary []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.URL.RequestURI()
		for _, name := range vary {
			key += "\n" + r.Header.Get(name)
		}
		if hit, ok := store.get(key); ok {
			header := w.Header()
			for name, values := range hit.header {
				header[name] = values
			}
			w.WriteHeader(hit.status)
			_, _ = w.Write(hit.body)
			return
		}
		copied := &copyingWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(copied, r)
		if copied.status == http.StatusOK {
			store.put(key, answer{http.StatusOK, w.Header().Clone(), copied.body.Bytes()})
		}
	})
}

// copyingWriter sends what a handler writes and keeps a copy of it.
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
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

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
