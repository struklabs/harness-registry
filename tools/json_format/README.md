# JSON Formatter

Import this directory as a Harness JavaScript tool package. Call `json_format`
with `text` containing JSON, optional `indent` (0–8, default 2), and optional
`sort_keys` (default false). The result is formatted JSON text.

Example: `{"text":"{\"b\":2,\"a\":1}","indent":0,"sort_keys":true}`
returns `{"a":1,"b":2}`. Invalid JSON or invalid options produce an error.

No network, workspace, or shell access. Numbers follow JavaScript precision;
avoid lossless transformations of integers beyond 2^53−1. Numeric-looking keys
follow JavaScript enumeration order. Licensed under the repository MIT license.
