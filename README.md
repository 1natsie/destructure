# destructure

[![JSR](https://jsr.io/badges/@1natsie/destructure)](https://jsr.io/@1natsie/destructure)
[![npm version](https://img.shields.io/npm/v/1n-destructure.svg)](https://www.npmjs.com/package/1n-destructure)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A powerful, type-safe, and high-performance TypeScript/JavaScript library for serializing and deserializing complex structured data into compact binary formats.

---

## Features

- **⚡ Blazing Fast**: Engineered for high-throughput encoding and decoding with zero unnecessary allocations.
- **📦 Minimal Binary Size**: Packed byte representations with explicit primitive types, string length headers, and bit packing.
- **🛡️ Full Type Safety**: Automatic TypeScript inference for both input types (`Data.Input<typeof schema>`) and output types (`Data.Output<typeof schema>`).
- **🧩 Rich Schema Model**: Built-in support for numeric primitives, 64-bit & 128-bit integers, floats, chars, arrays, tuples, objects, optionals, bit packing, raw byte streams, and custom encoders/decoders.
- **🔀 Schema Composition**: Modular schema composition with `merge`, `augment`, `append`, and `concatenate`.
- **❄️ Immutable & Pre-Compiled Schemas**: Pre-compile schemas with `schema()` for frozen, thread-safe, re-usable execution trees.
- **🌐 Universal Runtime**: Works seamlessly in Node.js, Deno, Bun, and web browsers.

---

## Installation

### Via JSR (Modern ESM / Deno / Bun / Node)

```bash
# Deno
deno add jsr:@1natsie/destructure

# Node.js
npx jsr add @1natsie/destructure

# Bun
bunx jsr add @1natsie/destructure

# pnpm
pnpm dlx jsr add @1natsie/destructure
```

### Via npm / yarn / pnpm

```bash
npm install 1n-destructure
```

---

## Quick Start

```typescript
import { encode } from "@1natsie/destructure/encode";
import { decode } from "@1natsie/destructure/decode";
import { schema, string, optional, array, bitpack, type Data } from "@1natsie/destructure/schema";

// 1. Define and pre-compile a schema
const playerSchema = schema({
  id: "u32",
  username: string.prefixedLength,
  score: "f64",
  inventory: "u16[4]", // Fixed-size 4-element array syntax
  statusFlags: bitpack(8), // 8 boolean flags packed into 1 byte
  guild: optional(string.nullTerminated), // Nullable C-style string
});

// 2. Derive TypeScript types automatically
type PlayerInput = Data.Input<typeof playerSchema>;
type PlayerOutput = Data.Output<typeof playerSchema>;

const player: PlayerInput = {
  id: 42,
  username: "Alice",
  score: 9950.5,
  inventory: [101, 102, 201, 305],
  statusFlags: [true, false, true, true, false, false, true, false],
  guild: "Knights of Code",
};

// 3. Encode JavaScript object into Uint8Array
const binary = encode(playerSchema, player);
console.log("Encoded binary size:", binary.length, "bytes");

// 4. DecodeUint8Array back into typed object
const decoded: PlayerOutput = decode(playerSchema, binary);
console.log("Decoded Player Username:", decoded.username);
console.log("Decoded Status Flags:", decoded.statusFlags);
```

---

## Core API Reference

### `encode<T>(schema, data): Uint8Array`

Serializes structured data into a `Uint8Array` according to the provided schema definition or pre-compiled schema.

```typescript
import { encode } from "@1natsie/destructure/encode";

const binary = encode(mySchema, payload);
```

### `decode<T>(schema, buffer, offset?): Data.Output<T>`

Deserializes a `Uint8Array` back into structured JavaScript data based on the schema. An optional byte `offset` (default `0`) can be specified to start decoding from a specific byte index.

```typescript
import { decode } from "@1natsie/destructure/decode";

const data = decode(mySchema, binaryBuffer, 0);
```

### `schema<T>(definition): CompiledSchema<T>`

Pre-compiles and deeply freezes a schema definition into an immutable schema object. Pre-compiling resolves nested key ordering, parses primitive array strings, and maximizes encoding/decoding performance.

```typescript
import { schema } from "@1natsie/destructure/schema";

const compiled = schema({
  id: "u64",
  title: "char[16]",
});
```

---

## Dedicated Schema Types & Usage Examples

### 1. Primitive Numeric & Character Schemas

Primitive strings represent fixed-width numeric scalars, floating-point numbers, and individual single-byte characters.

| Schema Type              | Description                              | Byte Size     | Input Type       | Output Type |
| :----------------------- | :--------------------------------------- | :------------ | :--------------- | :---------- |
| `"u8"`, `"u16"`, `"u32"` | Unsigned integers (8, 16, 32-bit)        | 1, 2, 4 bytes | `number`         | `number`    |
| `"i8"`, `"i16"`, `"i32"` | Signed integers (8, 16, 32-bit)          | 1, 2, 4 bytes | `number`         | `number`    |
| `"f32"`, `"f64"`         | Floating point (IEEE 754 float & double) | 4, 8 bytes    | `number`         | `number`    |
| `"char"`                 | Single ASCII / 1-byte UTF-8 character    | 1 byte        | `string` (len 1) | `string`    |

#### Usage Example

```typescript
import { encode, decode } from "@1natsie/destructure";

const statsSchema = {
  hp: "u16",
  mana: "i16",
  ratio: "f32",
  rank: "char",
};

const encoded = encode(statsSchema, {
  hp: 65000,
  mana: -120,
  ratio: 3.14,
  rank: "S",
});
const decoded = decode(statsSchema, encoded);
```

---

### 2. Large Integers (`u64`, `i64`, `u128`, `i128`)

For numbers exceeding standard JavaScript 32-bit integer limits, `destructure` provides 64-bit and 128-bit signed and unsigned integer primitives.

- **Output Type**: Always decoded as a `bigint`.
- **Input Type**: Accepts a `bigint`, a standard `number`, or an array of 32-bit unsigned integer segments (`[low, high]` for 64-bit; `[w0, w1, w2, w3]` for 128-bit).

| Schema Type        | Description      | Byte Size | Input Type                                 | Output Type |
| :----------------- | :--------------- | :-------- | :----------------------------------------- | :---------- |
| `"u64"`, `"i64"`   | 64-bit Integers  | 8 bytes   | `bigint \| number \| [u32, u32]`           | `bigint`    |
| `"u128"`, `"i128"` | 128-bit Integers | 16 bytes  | `bigint \| number \| [u32, u32, u32, u32]` | `bigint`    |

#### Usage Example

```typescript
const cryptoSchema = {
  balance: "u64",
  largeId: "u128",
};

// Input using BigInt or 32-bit segments array
const encoded = encode(cryptoSchema, {
  balance: 18446744073709551615n, // 64-bit unsigned max
  largeId: [0x76543210, 0xfedcba98, 0x89abcdef, 0x01234567], // 4 x 32-bit words
});

const decoded = decode(cryptoSchema, encoded);
console.log(typeof decoded.balance); // "bigint"
console.log(decoded.balance); // 18446744073709551615n
```

---

### 3. Primitive Array Shorthand Syntax

You can append `[]` (dynamic array) or `[N]` (fixed-length array) to any primitive type string.

- **Fixed-size array (`"type[N]"`)**: Encodes exactly `N` elements without length overhead.
- **Dynamic array (`"type[]"`)**: Encodes a 4-byte `uint32` length prefix followed by the array elements.

#### Usage Example

```typescript
const vectorSchema = {
  position: "f32[3]", // Fixed 3-element array of floats
  matrix: "i16[9]", // Fixed 9-element array
  readings: "u8[]", // Dynamic length-prefixed byte array
  initials: "char[3]", // Fixed 3-character tuple
};

const encoded = encode(vectorSchema, {
  position: [1.0, 2.0, 3.0],
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  readings: [10, 20, 30, 40, 50],
  initials: ["J", "D", "O"],
});
```

---

### 4. Objects (Deterministic Key Ordering)

Plain JavaScript objects define key-value structures.

> **Note on Key Ordering**: Object keys are **automatically sorted in lexicographical (alphabetical) order** during schema processing and binary encoding. This guarantees deterministic binary output regardless of JavaScript object key insert ordering.

#### Usage Example

```typescript
const userSchema = {
  username: "char[8]",
  id: "u32",
  active: "u8",
};

// Key order in object payload does not affect encoded binary layout
const encoded = encode(userSchema, {
  active: 1,
  id: 100,
  username: ["A", "l", "i", "c", "e", " ", " ", " "],
});
```

---

### 5. Tuples

Tuples are fixed-length ordered arrays of heterogeneous schemas defined using JavaScript arrays with `as const`.

#### Usage Example

```typescript
const point3DSchema = ["f64", "f64", "f64"] as const;

const recordSchema = {
  header: ["u8", "u16"] as const,
  location: point3DSchema,
};

const encoded = encode(recordSchema, {
  header: [1, 200],
  location: [12.34, 56.78, 90.12],
});
```

---

### 6. Complex Arrays (`array`)

Use the `array(elementSchema, count?)` helper to create arrays of complex nested schemas (objects, tuples, optionals, custom types).

- `count` omitted (or `-1`): Dynamic length-prefixed array (4-byte `u32` header).
- `count >= 0`: Fixed-length array of exactly `count` elements.

#### Usage Example

```typescript
import { array, string } from "@1natsie/destructure/schema";

const itemSchema = {
  id: "u32",
  name: string.prefixedLength,
};

const inventorySchema = {
  // Dynamic array of items
  items: array(itemSchema),
  // Fixed array of 2 equipment items
  equipment: array(itemSchema, 2),
};

const encoded = encode(inventorySchema, {
  items: [
    { id: 1, name: "Health Potion" },
    { id: 2, name: "Mana Potion" },
  ],
  equipment: [
    { id: 10, name: "Iron Sword" },
    { id: 11, name: "Wooden Shield" },
  ],
});
```

---

### 7. Bitpacking (`bitpack`)

The `bitpack(bitCount)` helper packs boolean arrays densely into bytes (8 booleans per byte, ordered from Most Significant Bit to Least Significant Bit).

- Input / Output: `boolean[]` with length equal to `bitCount`.
- Byte Size: `Math.ceil(bitCount / 8)` bytes.

#### Usage Example

```typescript
import { bitpack } from "@1natsie/destructure/schema";

// Pack 10 boolean flags into 2 bytes (16 bits)
const flagsSchema = bitpack(10);

const flags = [true, false, true, true, false, false, false, true, false, true];

const encoded = encode(flagsSchema, flags);
console.log(encoded.length); // 2 bytes instead of 10 bytes!

const decoded = decode(flagsSchema, encoded);
console.log(decoded); // Array of 10 boolean values
```

---

### 8. Optional Fields (`optional`)

Wrap any schema with `optional(innerSchema)` to allow `null` or `undefined` values.

- Presence Flag: Encodes a 1-byte boolean (`1` if present, `0` if absent).
- If present, the inner value is encoded immediately after the flag.
- Output: Returns the decoded value or `null`.

#### Usage Example

```typescript
import { optional, string } from "@1natsie/destructure/schema";

const profileSchema = {
  userId: "u32",
  bio: optional(string.prefixedLength),
  secondaryEmail: optional(string.nullTerminated),
};

const encoded = encode(profileSchema, {
  userId: 42,
  bio: null, // Encodes byte flag 0
  secondaryEmail: "alt@example.com", // Encodes byte flag 1 + string bytes
});

const decoded = decode(profileSchema, encoded);
console.log(decoded.bio); // null
```

---

### 9. Raw Bytes & Strings (`bytes`, `string`)

Built-in custom schemas for raw byte buffers and UTF-8 strings.

- **`bytes`**: Accepts `Uint8Array` or `ArrayLike<number>`. Encodes a 4-byte uint32 length header followed by raw bytes. Returns `Uint8Array`.
- **`string.prefixedLength`**: Length-prefixed UTF-8 string (4-byte length header + UTF-8 payload).
- **`string.nullTerminated`**: C-style UTF-8 string terminated by a `\0` null byte.

#### Usage Example

```typescript
import { bytes, string } from "@1natsie/destructure/schema";

const payloadSchema = {
  rawBuffer: bytes,
  title: string.prefixedLength,
  cString: string.nullTerminated,
};

const encoded = encode(payloadSchema, {
  rawBuffer: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  title: "Hello World 🔥",
  cString: "Null terminated string",
});
```

---

### 10. Custom Schemas (`custom`)

Create domain-specific custom encoders and decoders for types such as `Date`, custom classes, compressed data, or third-party formats.

```typescript
import { custom } from "@1natsie/destructure/schema";

// Custom schema handler for JavaScript Date objects (stored as 64-bit int ms)
const dateSchema = custom<Date>({
  encode: (date) => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigInt64(0, BigInt(date.getTime()), true);
    return buf;
  },
  decode: (bytes, offset) => {
    const timestamp = bytes.view.getBigInt64(offset, true);
    return {
      value: new Date(Number(timestamp)),
      nextOffset: offset + 8,
    };
  },
  size: () => ({ min: 8, max: 8 }),
});

// Usage
const eventSchema = {
  eventId: "u32",
  timestamp: dateSchema,
};

const encoded = encode(eventSchema, {
  eventId: 1001,
  timestamp: new Date("2026-01-01T00:00:00Z"),
});
```

---

### 11. Schema Composition (`combine`)

The `combine` namespace provides functional combinators to merge, extend, or join schemas safely.

#### `combine.merge(schemaA, schemaB)`

Merges two object schemas. Fields in `schemaB` overwrite matching fields in `schemaA`.

#### `combine.augment(schemaA, schemaB)`

Augments `schemaA` with fields from `schemaB`. Fields in `schemaA` take precedence.

#### `combine.append(schemaA, schemaB)`

Appends two disjoint object schemas. Throws a `ReferenceError` if duplicate keys exist.

#### `combine.concatenate(tupleA, tupleB)`

Concatenates two tuple schemas in order `[...tupleA, ...tupleB]`.

#### Usage Example

```typescript
import { combine, schema } from "@1natsie/destructure/schema";

const baseEntity = schema({ id: "u32", createdAt: "u64" });
const userFields = schema({ username: "u8[16]", email: "u8[32]" });
const auditFields = schema({ createdAt: "f64" }); // Overwrites createdAt type

// 1. Merge (userFields + auditFields overwriting createdAt)
const merged = combine.merge(baseEntity, auditFields);

// 2. Append disjoint schemas
const userSchema = combine.append(baseEntity, userFields);

// 3. Concatenate tuples
const tupleA = ["u8", "u16"] as const;
const tupleB = ["f32", "f64"] as const;
const combinedTuple = combine.concatenate(tupleA, tupleB);
```

---

## TypeScript Type Inference (`Data.Input` & `Data.Output`)

Use `Data.Input<typeof schema>` and `Data.Output<typeof schema>` to extract TypeScript types directly from your schema definitions.

```typescript
import { schema, string, optional, type Data } from "@1natsie/destructure/schema";

const productSchema = schema({
  sku: "u32",
  name: string.prefixedLength,
  discount: optional("f32"),
});

// Input type for encoding
type ProductInput = Data.Input<typeof productSchema>;
// Equivalent to:
// { sku: number; name: string; discount?: number | null }

// Output type for decoding
type ProductOutput = Data.Output<typeof productSchema>;
// Equivalent to:
// { sku: number; name: string; discount: number | null }
```

---

## Running Tests

Run the comprehensive unit test suite to verify encoding and decoding behavior across all schema types:

```bash
npm test
```

---

## License

[MIT](LICENSE) © Oghenevwegba Obire
