# @1natsie/destructure

A powerful, type-safe, and highly efficient library for the serialisation and deserialisation of structured data into compact binary formats.

## Features

- **🚀 Performance Optimized**: Designed for high-speed encoding and decoding.
- **📦 Compact Binary Format**: Minimal overhead compared to JSON or other text-based formats.
- **🛡️ Type Safe**: Full TypeScript support with automatic type inference for your data structures.
- **🧩 Flexible Schemas**: Support for primitives, objects, arrays, tuples, optionals, and custom handlers.
- **🌐 Cross-Platform**: Works in Node.js, Deno, and the browser.

## Installation

### Via JSR (Recommended for Deno/Modern ESM)

```bash
# Deno
deno add jsr:@1natsie/destructure

# Node.js (via npx)
npx jsr add @1natsie/destructure
```

### Via npm/yarn/pnpm

```bash
npm install 1n-destructure
```

## Basic Usage

```typescript
import { encode } from "@1natsie/destructure/encode";
import { decode } from "@1natsie/destructure/decode";
import { string, type Data } from "@1natsie/destructure/schema";

// Define a schema
const userSchema = {
  id: "u32",
  username: string,
  age: "u8",
  tags: ["char", "char", "char"] as const, // Fixed-size tuple
};

// Data to encode (Type-safe!)
const user: Data.Input<typeof userSchema> = {
  id: 1234,
  username: "johndoe",
  age: 30,
  tags: ["A", "B", "C"],
};

// Encode to Uint8Array
const binary = encode(userSchema, user);

// Decode back to object
const decoded = decode(userSchema, binary);
console.log(decoded.username); // "johndoe"
```

## API Documentation

### Main Entry Points

#### `encode<T>(schema: T, data: Data.Input<T>): Uint8Array`
Serialises data into a `Uint8Array` based on the provided schema.

#### `decode<T>(schema: T, buffer: Uint8Array): Data.Output<T>`
Deserialises a `Uint8Array` back into structured data based on the schema.

---

### Schema Primitives

The following primitive strings can be used in your schemas:

| Type | Description | Byte Size |
| :--- | :--- | :--- |
| `u8`, `u16`, `u32` | Unsigned Integers (8, 16, 32 bit) | 1, 2, 4 |
| `i8`, `i16`, `i32` | Signed Integers (8, 16, 32 bit) | 1, 2, 4 |
| `f32`, `f64` | Floats (32, 64 bit) | 4, 8 |
| `char` | Single ASCII/UTF-8 character | 1 |

Example:
```typescript
const s = "u32";
const s2 = "f64";
```

---

### Complex Schema Helpers

#### `array(schema, count?)`
Defines an array of a specific schema.
- If `count` is omitted (or set to `-1`), the array is dynamic and prefixed with a 4-byte length.
- If `count` is provided, the array is fixed-size.

```typescript
import { array } from "@1natsie/destructure/schema";

const dynamicArray = array("u8"); // Length-prefixed
const fixedArray = array("u16", 5); // Exactly 5 elements
const simpleSyntax = "u8[]"; // Equivalent to array("u8")
const fixedSyntax = "u8[10]"; // Equivalent to array("u8", 10)
```

#### `optional(schema)`
Defines a field that may be `undefined`. Prefixed with a 1-byte boolean flag (0 or 1).

```typescript
import { optional } from "@1natsie/destructure/schema";

const schema = {
  required: "u32",
  maybe: optional("u16"),
};
```

#### `string` and `string.nullTerminated`
Handlers for string data.
- `string`: Prefixed with a 4-byte length. Supports full UTF-8.
- `string.nullTerminated`: C-style string ending in `\0`. No length prefix.

```typescript
import { string } from "@1natsie/destructure/schema";

const schema = {
  normal: string,
  legacy: string.nullTerminated,
};
```

#### `bytes`
Handler for raw `Uint8Array` data. Prefixed with a 4-byte length.

```typescript
import { bytes } from "@1natsie/destructure/schema";

const schema = {
  raw: bytes,
};
```

#### `custom(handler)`
Create your own custom serialisation logic.

```typescript
import { custom } from "@1natsie/destructure/schema";

const dateHandler = custom<Date>({
  encode: (d) => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(d.getTime()), true);
    return buf;
  },
  decode: (bytes, offset) => {
    const time = bytes.view.getBigUint64(offset, true);
    return { value: new Date(Number(time)), nextOffset: offset + 8 };
  },
  size: () => ({ value: 8, isVariable: false }),
});
```

---

### Objects and Tuples

#### Objects
Plain objects define key-value structures. Keys are sorted alphabetically during encoding to ensure consistent binary output.

```typescript
const user = {
  name: string,
  age: "u8",
};
```

#### Tuples
Arrays in the schema define fixed-order tuples.

```typescript
const point = ["f32", "f32", "f32"] as const;
```

---

## Use Cases

1. **Network Protocols**: Building custom binary protocols for WebSockets or TCP.
2. **File Storage**: Saving complex state in a compact, easy-to-read binary format.
3. **IPC (Inter-Process Communication)**: Passing data between workers or processes with minimal overhead.
4. **Performance Critical Apps**: Games or real-time data visualisations where JSON parsing is a bottleneck.

## Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git checkout -b feature/my-feature`
5. Submit a pull request.

Please ensure all tests pass by running:
```bash
node ./testing/destructure.test.ts
```

## License

MIT © Oghenevwegba Obire
