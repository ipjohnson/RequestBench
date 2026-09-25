package implementation

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// VariedOutput answers a payload, says in Vary what the answer depends on, and writes the next
// serial.
type VariedOutput struct {
	Vary   string `header:"Vary"`
	Serial string `header:"x-rb-serial"`
	Body   *Payload
}

// cacheRoutes put the cache operations in a group whose middleware replays a stored answer and
// skips the handler. Huma has no response cache, so the store and the middleware are written for
// it. The handler writes x-rb-serial, so a replayed answer repeats the serial it was stored with.
func cacheRoutes(api huma.API, p *Payloads) {
	settings := p.Settings.Cache
	one := headerNames(settings.Vary.One)
	many := headerNames(settings.Vary.Many)
	// rb:wiring cache.*
	store := newStore(settings.Capacity, time.Duration(settings.TTLSeconds)*time.Second)

	byPath := huma.NewGroup(api)
	byPath.UseMiddleware(replay(store, nil))

	huma.Get(byPath, "/cache/small", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Small), nil })

	huma.Get(byPath, "/cache/medium", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Medium), nil })

	huma.Get(byPath, "/cache/large", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Large), nil })

	byTenant := huma.NewGroup(api)
	byTenant.UseMiddleware(replay(store, one))

	huma.Get(byTenant, "/cache/vary/one", func(ctx context.Context, _ *struct{}) (*VariedOutput, error) {
		return &VariedOutput{Vary: strings.Join(one, ", "), Serial: nextSerial(), Body: &p.Small}, nil
	})

	byAll := huma.NewGroup(api)
	byAll.UseMiddleware(replay(store, many))

	huma.Get(byAll, "/cache/vary/many", func(ctx context.Context, _ *struct{}) (*VariedOutput, error) {
		return &VariedOutput{Vary: strings.Join(many, ", "), Serial: nextSerial(), Body: &p.Small}, nil
	})
}

// rb:wiring cache.*
// replay answers from the store before the handler runs, and otherwise stores what the handler
// wrote. The key is the path and query, and the request headers the operation varies on.
func replay(store *store, vary []string) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		url := ctx.URL()
		key := url.RequestURI()
		for _, name := range vary {
			key += "\n" + ctx.Header(name)
		}
		if hit, ok := store.get(key); ok {
			for name, values := range hit.header {
				for _, value := range values {
					ctx.AppendHeader(name, value)
				}
			}
			ctx.SetStatus(hit.status)
			_, _ = ctx.BodyWriter().Write(hit.body)
			return
		}
		copied := &copyingContext{humaContext: ctx, header: http.Header{}}
		next(copied)
		if copied.status == http.StatusOK {
			store.put(key, answer{http.StatusOK, copied.header, copied.body.Bytes()})
		}
	}
}

// copyingContext sends what the handler writes and keeps a copy of it.
type copyingContext struct {
	humaContext
	status int
	header http.Header
	body   bytes.Buffer
}

func (c *copyingContext) Unwrap() huma.Context { return c.humaContext }

func (c *copyingContext) SetStatus(code int) {
	c.status = code
	c.humaContext.SetStatus(code)
}

func (c *copyingContext) SetHeader(name, value string) {
	c.header.Set(name, value)
	c.humaContext.SetHeader(name, value)
}

func (c *copyingContext) AppendHeader(name, value string) {
	c.header.Add(name, value)
	c.humaContext.AppendHeader(name, value)
}

func (c *copyingContext) BodyWriter() io.Writer { return c }

func (c *copyingContext) Write(data []byte) (int, error) {
	c.body.Write(data)
	return c.humaContext.BodyWriter().Write(data)
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
