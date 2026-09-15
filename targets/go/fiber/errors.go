// The two error shapes the domain returns, recognised without importing errors into every
// family file.
package main

import (
	"errors"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func isNotFound(err error) bool { return errors.Is(err, d.ErrNotFound) }

func asValidation(err error, target **d.ValidationError) bool { return errors.As(err, target) }
