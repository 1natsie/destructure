# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-10

### Added

- **64-bit and 128-bit integer primitives**: `"u64"`, `"i64"`, `"u128"`, and `"i128"`.
  - Decoded values are always `bigint`.
  - Encoding accepts `bigint`, `number`, or an array of 32-bit unsigned segments (`[low, high]` for 64-bit; `[w0, w1, w2, w3]` for 128-bit).
- **`bitpack(bitCount)`**: Dense packing of a fixed-length `boolean[]` into the minimum number of bytes (MSB-first).
- **Schema composition** via the `combine` namespace:
  - `combine.merge(a, b)` – merge two object schemas (fields from `b` override `a`).
  - `combine.augment(a, b)` – augment `a` with fields from `b` (fields from `a` take precedence).
  - `combine.append(a, b)` – append two disjoint object schemas (throws on key collision).
  - `combine.concatenate(a, b)` – concatenate two tuple schemas.
- Explicit `string.prefixedLength` for length-prefixed UTF-8 strings.
- Stricter runtime validation for array counts, bitpack sizes, char values, and truncated input buffers, with clearer error messages.
- Improved TypeScript inference for the new primitives, bitpacks, and optional fields.

### Changed

- **Breaking – String schema API**  
  The top-level `string` export is no longer a usable schema.  
  Use `string.prefixedLength` (length-prefixed) or `string.nullTerminated` instead.
- **Breaking – Optional field decoding**  
  Absent optional fields now decode to `null` (previously `undefined`).  
  Passing `null` (or `undefined`) on encode is treated as absent.
- **Breaking – Custom schema `size()` signature**  
  Handlers must now return `{ min: number; max: number }` instead of `{ value: number; isVariable: boolean }`.
- **Breaking – Removed public helpers**  
  `source()` and `isCustomSchema` are no longer part of the public API.
- Compiled schemas are now deeply frozen and use a more stable internal representation (`schemaType` instead of `type`).
- Object keys continue to be sorted lexicographically for deterministic binary layout.

### Fixed

- Corrected regex bug that may have caused `Invalid struct.` errors when compiling simple schemas using
  the shorthand array syntax with more than one digit, e.g, `u8[10]`
- More robust handling of truncated or malformed buffers (throws instead of producing incorrect results).
- Char values are rejected when they cannot be represented in a single byte.
- Fixed-length and dynamic array length mismatches produce consistent errors on both encode and decode.
