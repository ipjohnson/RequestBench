// The one error shape the domain still returns, recognised without importing errors into
// every family file. Validation failures are Fiber's own now and are answered where they
// happen, so there is nothing to unwrap for them.
package main

import (
	"errors"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring errors.*
func isNotFound(err error) bool { return errors.Is(err, d.ErrNotFound) }
