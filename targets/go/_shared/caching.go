package domain

import (
	"bytes"
	"container/list"
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"sort"
	"sync"
	"time"
)

// The two caching families, and the one piece Go has to bring.
//
// Nothing in net/http computes a validator for a dynamic response or answers
// If-None-Match against one, and nothing in it stores a response either. Four of the five
// frameworks ship neither as well, so what they share is the digest and the store, for the
// same reason Gzip above is here: five copies would drift on an algorithm and the drift
// would read as a framework result. Where they differ is how each attaches them, which is
// the part that is actually the framework's. Fiber is the exception and uses its own
// etag and cache middleware.

// ContentETag is the validator over the exact response bytes: sha1, quoted and strong,
// which is what Werkzeug and the Node ecosystem both reach for.
func ContentETag(body []byte) string {
	sum := sha1.Sum(body)
	return `"` + hex.EncodeToString(sum[:]) + `"`
}

// CacheSpec is what the fixture pins about the response cache every target holds.
func CacheSpec() CacheDoc { return cacheDoc }

// VaryOn is the header names one vary row is keyed on. Sorted, so the key a target builds
// does not depend on Go's map iteration order.
func VaryOn(which string) []string {
	names := make([]string, 0, len(cacheDoc.Vary[which]))
	for name := range cacheDoc.Vary[which] {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// Stored is one response held in a Store: everything needed to write it again.
type Stored struct {
	Status int
	Header map[string][]string
	Body   []byte
}

// Store is an LRU with a per-entry expiry, sized from the fixture. Capped rather than
// unbounded because a store that grows without one cannot evict, and the point of the
// capacity is that nothing evicts inside a run: a cap the key count fits under says that
// out loud where an unbounded map would only happen to be true.
type Store struct {
	mu    sync.Mutex
	max   int
	ttl   time.Duration
	order *list.List
	items map[string]*list.Element
}

type entry struct {
	key     string
	value   Stored
	expires time.Time
}

func NewStore() *Store {
	spec := CacheSpec()
	return &Store{
		max:   spec.Capacity,
		ttl:   time.Duration(spec.TTLSec) * time.Second,
		order: list.New(),
		items: make(map[string]*list.Element, spec.Capacity),
	}
}

func (s *Store) Get(key string) (Stored, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	el, ok := s.items[key]
	if !ok {
		return Stored{}, false
	}
	e := el.Value.(*entry)
	if time.Now().After(e.expires) {
		s.order.Remove(el)
		delete(s.items, key)
		return Stored{}, false
	}
	s.order.MoveToFront(el)
	return e.value, true
}

func (s *Store) Set(key string, value Stored) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if el, ok := s.items[key]; ok {
		el.Value.(*entry).value = value
		el.Value.(*entry).expires = time.Now().Add(s.ttl)
		s.order.MoveToFront(el)
		return
	}
	el := s.order.PushFront(&entry{key: key, value: value, expires: time.Now().Add(s.ttl)})
	s.items[key] = el
	for s.order.Len() > s.max {
		oldest := s.order.Back()
		s.order.Remove(oldest)
		delete(s.items, oldest.Value.(*entry).key)
	}
}

// CacheKey is the path plus the value of each header this route is keyed on.
func CacheKey(path string, values []string) string {
	key := path
	for _, v := range values {
		key += "|" + v
	}
	return key
}

// ---- the net/http middleware two targets share ------------------------------
//
// chi and gorilla-mux both route plain http.Handlers, so the middleware is the same
// function for both and only where each attaches it differs. Echo and Gin wrap the
// response in their own types and hold their own; Fiber uses its own etag and cache
// middleware and holds neither.

// capture holds a response until the middleware around it has hashed or stored the bytes.
type capture struct {
	http.ResponseWriter
	buf    bytes.Buffer
	status int
}

func (c *capture) WriteHeader(status int) { c.status = status }

func (c *capture) Write(p []byte) (int, error) {
	if c.status == 0 {
		c.status = http.StatusOK
	}
	return c.buf.Write(p)
}

// ConditionalGet hashes the body the handler wrote, writes the validator, and answers
// If-None-Match with a 304.
//
// Shallow, which is the point: the handler runs and the body is built before anything is
// compared, so the 304 saves the write and nothing else.
func ConditionalGet(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		buffer := &capture{ResponseWriter: w}
		next.ServeHTTP(buffer, req)
		body := buffer.buf.Bytes()
		etag := ContentETag(body)
		w.Header().Set("etag", etag)
		w.Header().Set("cache-control", Cacheable)
		if req.Header.Get("if-none-match") == etag {
			w.Header().Del("content-type")
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.WriteHeader(buffer.status)
		_, _ = w.Write(body)
	})
}

// Replay answers from the store when it holds the key, and stores what the handler wrote
// when it does not. The key is the path plus the value of each header named in on.
func Replay(store *Store, on []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			values := make([]string, len(on))
			for i, name := range on {
				values[i] = req.Header.Get(name)
			}
			key := CacheKey(req.URL.Path, values)
			if hit, ok := store.Get(key); ok {
				for name, vs := range hit.Header {
					for _, v := range vs {
						w.Header().Add(name, v)
					}
				}
				w.WriteHeader(hit.Status)
				_, _ = w.Write(hit.Body)
				return
			}
			buffer := &capture{ResponseWriter: w}
			next.ServeHTTP(buffer, req)
			body := buffer.buf.Bytes()
			if buffer.status == http.StatusOK {
				store.Set(key, Stored{Status: 200, Header: w.Header().Clone(), Body: body})
			}
			w.WriteHeader(buffer.status)
			_, _ = w.Write(body)
		})
	}
}
