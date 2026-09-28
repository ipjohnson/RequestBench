package implementation

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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

// Payloads are the committed payloads, read from the directory RB_PAYLOADS names before the
// server listens, so a missing or broken file stops the boot rather than failing a request.
// The parsed values are kept and serialised on every request.
type Payloads struct {
	Directory string
	Small     Payload
	Medium    Payload
	Large     Payload
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
