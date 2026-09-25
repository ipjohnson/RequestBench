package implementation

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

// Item is one row of items.large, and of every payload made from it.
type Item struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Category   string `json:"category"`
	PriceCents int    `json:"priceCents"`
	InStock    bool   `json:"inStock"`
}

// Payload is items.small, items.medium or items.large.
type Payload struct {
	Size  string `json:"size"`
	Count int    `json:"count"`
	Items []Item `json:"items"`
}

// Settings holds the values the framework configures itself from, as settings.json holds them.
type Settings struct {
	Token      string        `json:"token"`
	WrongToken string        `json:"wrongToken"`
	StaleEtag  string        `json:"staleEtag"`
	Cache      CacheSettings `json:"cache"`
	Cors       CorsSettings  `json:"cors"`
}

type CacheSettings struct {
	Capacity   int          `json:"capacity"`
	TTLSeconds int          `json:"ttlSeconds"`
	Vary       VarySettings `json:"vary"`
}

// VarySettings holds the values each vary row is keyed on, by header.
type VarySettings struct {
	One  map[string][]string `json:"one"`
	Many map[string][]string `json:"many"`
}

type CorsSettings struct {
	Origin        string `json:"origin"`
	Method        string `json:"method"`
	Header        string `json:"header"`
	MaxAgeSeconds int    `json:"maxAgeSeconds"`
}

// Payloads are the committed payloads, read from the directory RB_PAYLOADS names before the
// server listens, so a missing or broken file stops the boot rather than failing a request.
// The parsed values are kept and serialised on every request.
type Payloads struct {
	Directory string
	Small     Payload
	Medium    Payload
	Large     Payload
	Settings  Settings
	rows      map[int]Item
}

func Load(directory string) (*Payloads, error) {
	directory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	p := &Payloads{Directory: directory}
	for file, into := range map[string]any{
		"items.small.json":  &p.Small,
		"items.medium.json": &p.Medium,
		"items.large.json":  &p.Large,
		"settings.json":     &p.Settings,
	} {
		bytes, err := os.ReadFile(filepath.Join(directory, file))
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(bytes, into); err != nil {
			return nil, fmt.Errorf("%s: %w", file, err)
		}
	}
	p.rows = make(map[int]Item, len(p.Large.Items))
	for _, row := range p.Large.Items {
		p.rows[row.ID] = row
	}
	return p, nil
}

// Row is the row of items.large with this id.
func (p *Payloads) Row(id int) (Item, bool) {
	row, ok := p.rows[id]
	return row, ok
}

// headerNames are the names a vary setting keys on, in a fixed order for the key and the Vary header.
func headerNames(values map[string][]string) []string {
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}
