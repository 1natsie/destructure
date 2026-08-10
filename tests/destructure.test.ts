/// <reference types="node" />

import { expect } from "chai";
import { describe, it } from "node:test";

import { decode } from "../src/decoder/decoder.ts";
import { encode } from "../src/encoder/encoder.ts";
import {
  array,
  bitpack,
  bytes,
  combine,
  custom,
  optional,
  schema,
  string,
  type Data,
} from "../src/schema/schema.ts";

const bytesOf = (...values: number[]) => new Uint8Array(values);

describe("destructure", () => {
  describe("primitive schemas", () => {
    it("encodes and decodes every numeric primitive", () => {
      const cases = [
        ["u8", 0xff, bytesOf(0xff)],
        ["u16", 0x1234, bytesOf(0x34, 0x12)],
        ["u32", 0x12345678, bytesOf(0x78, 0x56, 0x34, 0x12)],
        ["i8", -2, bytesOf(0xfe)],
        ["i16", -0x1234, bytesOf(0xcc, 0xed)],
        ["i32", -2, bytesOf(0xfe, 0xff, 0xff, 0xff)],
      ] as const;

      for (const [primitive, value, expected] of cases) {
        const encoded = encode(primitive, value);
        expect(encoded, primitive).to.deep.equal(expected);
        expect(decode(primitive, encoded), primitive).to.equal(value);
      }
    });

    it("encodes and decodes floating-point primitives in little-endian order", () => {
      const f32Encoded = encode("f32", Math.PI);
      const f64Encoded = encode("f64", Math.PI);

      expect(f32Encoded).to.deep.equal(bytesOf(0xdb, 0x0f, 0x49, 0x40));
      expect(f64Encoded).to.deep.equal(bytesOf(0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40));
      expect(decode("f32", f32Encoded)).to.be.approximately(Math.PI, 1e-6);
      expect(decode("f64", f64Encoded)).to.equal(Math.PI);
    });

    it("encodes and decodes char values", () => {
      const encoded = encode("char", "A");

      expect(encoded).to.deep.equal(bytesOf(65));
      expect(decode("char", encoded)).to.equal("A");
    });

    it("rejects char values that cannot be represented by one byte", () => {
      expect(() => encode("char", "🔥")).to.throw(TypeError);
      expect(() => encode("char", "AB")).to.throw(Error);
    });
  });

  describe("large integer primitives", () => {
    it("encodes and decodes u64 using bigint", () => {
      const value = 0x0123456789abcdefn;
      const encoded = encode("u64", value);

      expect(encoded).to.deep.equal(bytesOf(0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01));
      expect(decode("u64", encoded)).to.equal(value);
    });

    it("encodes and decodes signed i64 boundaries", () => {
      const values = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n];

      for (const value of values) expect(decode("i64", encode("i64", value))).to.equal(value);
    });

    it("accepts two 32-bit segments as u64 input", () => {
      const value: Data.Input<"u64"> = [0x89abcdef, 0x01234567];

      expect(encode("u64", value)).to.deep.equal(
        bytesOf(0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01),
      );
    });

    it("encodes and decodes u128 using low-word-first little-endian bytes", () => {
      const value = 0x0123456789abcdeffedcba9876543210n;
      const encoded = encode("u128", value);

      expect(encoded).to.deep.equal(
        bytesOf(
          0x10,
          0x32,
          0x54,
          0x76,
          0x98,
          0xba,
          0xdc,
          0xfe,
          0xef,
          0xcd,
          0xab,
          0x89,
          0x67,
          0x45,
          0x23,
          0x01,
        ),
      );
      expect(decode("u128", encoded)).to.equal(value);
    });

    it("round-trips unsigned 128-bit boundaries", () => {
      const values = [0n, 1n, 2n ** 63n, 2n ** 64n - 1n, 2n ** 127n, 2n ** 128n - 1n];

      for (const value of values) expect(decode("u128", encode("u128", value))).to.equal(value);
    });

    it("encodes and decodes signed i128 boundaries", () => {
      const values = [-(2n ** 127n), -1n, 0n, 1n, 2n ** 127n - 1n];

      for (const value of values) expect(decode("i128", encode("i128", value))).to.equal(value);
    });

    it("accepts four 32-bit segments as u128 input", () => {
      const value: Data.Input<"u128"> = [0x76543210, 0xfedcba98, 0x89abcdef, 0x01234567];

      expect(decode("u128", encode("u128", value))).to.equal(0x0123456789abcdeffedcba9876543210n);
    });

    it("returns bigint values for all large integer outputs", () => {
      expect(typeof decode("u64", encode("u64", 1n))).to.equal("bigint");
      expect(typeof decode("i64", encode("i64", -1n))).to.equal("bigint");
      expect(typeof decode("u128", encode("u128", 1n))).to.equal("bigint");
      expect(typeof decode("i128", encode("i128", -1n))).to.equal("bigint");
    });
  });

  describe("primitive array syntax", () => {
    it("encodes and decodes fixed numeric arrays", () => {
      const value = [1, 2, 3, 4];
      const encoded = encode("u8[4]", value);

      expect(encoded).to.deep.equal(bytesOf(1, 2, 3, 4));
      expect(decode("u8[4]", encoded)).to.deep.equal(value);
    });

    it("encodes and decodes dynamic numeric arrays with a length prefix", () => {
      const value = [1000, 2000, 3000];
      const encoded = encode("u16[]", value);

      expect(encoded).to.deep.equal(bytesOf(3, 0, 0, 0, 0xe8, 0x03, 0xd0, 0x07, 0xb8, 0x0b));
      expect(decode("u16[]", encoded)).to.deep.equal(value);
    });

    it("supports fixed and dynamic char arrays", () => {
      const fixed = ["A", "B", "C"];
      const dynamic = ["x", "y"];

      expect(encode("char[3]", fixed)).to.deep.equal(bytesOf(65, 66, 67));
      expect(decode("char[3]", encode("char[3]", fixed))).to.deep.equal(fixed);
      expect(decode("char[]", encode("char[]", dynamic))).to.deep.equal(dynamic);
    });

    it("validates fixed primitive array lengths", () => {
      expect(() => encode("u8[2]", [1])).to.throw(Error, "Element count mismatch");
      expect(() => encode("u8[2]", [1, 2, 3])).to.throw(Error, "Element count mismatch");
      expect(() => encode("char[2]", ["A"])).to.throw(Error, "Element count mismatch");
    });

    it("supports dynamic arrays through array()", () => {
      const s = array("u8");
      const value = [9, 8, 7];

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("supports fixed arrays through array()", () => {
      const s = array("u16", 2);
      const value = [500, 1000];

      expect(decode(s, encode(s, value))).to.deep.equal(value);
      expect(() => encode(s, [500])).to.throw(Error, "Element count mismatch");
    });

    it("supports zero-length fixed arrays", () => {
      const s = array("u8", 0);

      expect(encode(s, [])).to.deep.equal(bytesOf());
      expect(decode(s, encode(s, []))).to.deep.equal([]);
    });

    it("validates array helper counts", () => {
      expect(() => array("u8", -2)).to.throw(RangeError);
      expect(() => array("u8", 1.5)).to.throw(TypeError);
      expect(() => array("u8", Infinity)).to.throw(TypeError);
    });
  });

  describe("objects and tuples", () => {
    it("encodes object fields in sorted key order", () => {
      const s = { b: "u8", a: "u16" } as const;
      const encoded = encode(s, { a: 0x1234, b: 0x56 });

      expect(encoded).to.deep.equal(bytesOf(0x34, 0x12, 0x56));
      expect(decode(s, encoded)).to.deep.equal({ a: 0x1234, b: 0x56 });
    });

    it("supports deeply nested objects and tuples", () => {
      const s = schema({
        header: { version: "u8", flags: bitpack(3) },
        payload: ["i32", { value: "f64" }, "char"] as const,
      });
      const value: Data.Input<typeof s> = {
        header: { version: 2, flags: [true, false, true] },
        payload: [-99, { value: Math.PI }, "Z"],
      };

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("rejects non-object and non-tuple payloads", () => {
      expect(() => encode({ value: "u8" }, null as never)).to.throw(TypeError);
      expect(() => encode(["u8"] as const, { value: 1 } as never)).to.throw(TypeError);
    });
  });

  describe("bitpack", () => {
    it("packs bits from most significant to least significant order", () => {
      const s = bitpack(10);
      const value = [true, false, true, true, false, false, false, true, false, true];

      expect(encode(s, value as any)).to.deep.equal(bytesOf(0b10110001, 0b01000000));
      expect(decode(s, encode(s, value as any))).to.deep.equal(value);
    });

    it("handles all false, all true, partial bytes, and exact byte boundaries", () => {
      for (const count of [1, 7, 8, 9, 16]) {
        const falseValue = new Array(count).fill(false);
        const trueValue = new Array(count).fill(true);

        expect(decode(bitpack(count), encode(bitpack(count), falseValue as any))).to.deep.equal(
          falseValue,
        );
        expect(decode(bitpack(count), encode(bitpack(count), trueValue as any))).to.deep.equal(
          trueValue,
        );
      }
    });

    it("validates bit counts and payload lengths", () => {
      expect(() => bitpack(0)).to.throw(TypeError);
      expect(() => bitpack(-1)).to.throw(TypeError);
      expect(() => bitpack(1.5)).to.throw(TypeError);
      expect(() => encode(bitpack(3), [true, false] as any)).to.throw(
        Error,
        "Element count mismatch",
      );
      expect(() => encode(bitpack(3), true as never)).to.throw(TypeError);
    });
  });

  describe("optional schemas", () => {
    const s = {
      required: "u16",
      maybeNumber: optional("i32"),
      maybeArray: optional(array("u8", 2)),
    } as const;

    it("encodes and decodes supplied optional values", () => {
      const value: Data.Input<typeof s> = {
        required: 1234,
        maybeNumber: -42,
        maybeArray: [5, 6],
      };

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("encodes missing optional values with a zero presence marker", () => {
      const value: Data.Input<typeof s> = { required: 1234 };
      const encoded = encode(s, value);

      // Object fields are encoded alphabetically: maybeArray, maybeNumber, required.
      expect(encoded).to.deep.equal(bytesOf(0, 0, 0xd2, 0x04));
      expect(decode(s, encoded)).to.deep.equal({
        required: 1234,
        maybeNumber: null,
        maybeArray: null,
      });
    });

    it("treats null as absent for optional values", () => {
      const s = optional("u8");

      expect(encode(s, null as any)).to.deep.equal(bytesOf(0));
      expect(decode(s, bytesOf(0))).to.equal(null);
    });
  });

  describe("built-in custom schemas", () => {
    it("encodes and decodes bytes with a four-byte length prefix", () => {
      const value = new Uint8Array([1, 2, 3, 255]);
      const encoded = encode(bytes, value);

      expect(encoded).to.deep.equal(bytesOf(4, 0, 0, 0, 1, 2, 3, 255));
      expect(decode(bytes, encoded)).to.deep.equal(value);
    });

    it("accepts array-like byte input and returns Uint8Array output", () => {
      const value = [10, 20, 30];

      expect(decode(bytes, encode(bytes, value))).to.deep.equal(new Uint8Array(value));
    });

    it("validates byte values", () => {
      expect(() => encode(bytes, [0, 256])).to.throw(TypeError, "Invalid element");
      expect(() => encode(bytes, [-1])).to.throw(TypeError, "Invalid element");
      expect(() => encode(bytes, [1.5])).to.throw(TypeError, "Invalid element");
    });

    it("encodes and decodes length-prefixed UTF-8 strings", () => {
      const value = "Hello, 世界 🔥";
      const encoded = encode(string.prefixedLength, value);

      expect(new DataView(encoded.buffer).getUint32(0, true)).to.equal(
        new TextEncoder().encode(value).length,
      );
      expect(decode(string.prefixedLength, encoded)).to.equal(value);
    });

    it("supports empty length-prefixed strings", () => {
      expect(encode(string.prefixedLength, "")).to.deep.equal(bytesOf(0, 0, 0, 0));
      expect(decode(string.prefixedLength, bytesOf(0, 0, 0, 0))).to.equal("");
    });

    it("encodes and decodes null-terminated UTF-8 strings", () => {
      const value = "Hello 🚀";
      const encoded = encode(string.nullTerminated, value);

      expect(encoded[encoded.length - 1]).to.equal(0);
      expect(decode(string.nullTerminated, encoded)).to.equal(value);
    });

    it("rejects embedded null characters", () => {
      expect(() => encode(string.nullTerminated, "before\0after")).to.throw(
        TypeError,
        "Null terminator within string",
      );
    });
  });

  describe("custom schemas", () => {
    it("encodes and decodes Date values", () => {
      const dateSchema = custom<Date>({
        encode: (value) => {
          const result = new Uint8Array(8);
          new DataView(result.buffer).setBigInt64(0, BigInt(value.getTime()), true);
          return result;
        },
        decode: (value, offset) => ({
          value: new Date(Number(value.view.getBigInt64(offset, true))),
          nextOffset: offset + 8,
        }),
        size: () => ({ min: 8, max: 8 }),
      });
      const value = new Date("2024-01-02T03:04:05.000Z");

      expect(decode(dateSchema, encode(dateSchema, value))).to.deep.equal(value);
    });

    it("supports custom input and output types", () => {
      const hexSchema = custom<string, number>({
        encode: (value) => {
          const result = new Uint8Array(4);
          new DataView(result.buffer).setUint32(0, Number.parseInt(value, 16), true);
          return result;
        },
        decode: (value, offset) => ({
          value: value.view.getUint32(offset, true),
          nextOffset: offset + 4,
        }),
        size: () => ({ min: 4, max: 4 }),
      });

      expect(decode(hexSchema, encode(hexSchema, "12345678"))).to.equal(0x12345678);
    });

    it("rejects malformed custom handlers", () => {
      expect(() => custom({} as never)).to.throw(Error, "Invalid custom schema handler");
      expect(() => custom({ encode: () => new Uint8Array() } as never)).to.throw(
        Error,
        "Invalid custom schema handler",
      );
    });
  });

  describe("schema composition", () => {
    it("merges objects with the second schema taking precedence", () => {
      const s = combine.merge({ a: "u8", shared: "u8" }, { b: "u16", shared: "u16" });
      const value = { a: 1, b: 0x1234, shared: 0x5678 };

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("augments objects with the first schema taking precedence", () => {
      const s = combine.augment({ a: "u8", shared: "u8" }, { b: "u16", shared: "u16" });
      const value = { a: 1, b: 0x1234, shared: 0x56 };

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("appends disjoint object schemas", () => {
      const s = combine.append({ z: "u8" }, { a: "u16" });
      const value = { a: 0x1234, z: 0x56 };

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("rejects duplicate keys with append", () => {
      expect(() => combine.append({ value: "u8" }, { value: "u16" })).to.throw(
        ReferenceError,
        "already exists",
      );
    });

    it("concatenates tuples in order", () => {
      const s = combine.concatenate(["u8", "char"] as const, ["u16", "i8"] as const);
      const value: Data.Input<typeof s> = [1, "A", 0x1234, -2];

      expect(decode(s, encode(s, value))).to.deep.equal(value);
    });

    it("rejects incompatible schema kinds", () => {
      expect(() => combine.merge({ value: "u8" } as any, ["u8"] as any)).to.throw(TypeError);
      expect(() => combine.concatenate(["u8"] as const, { value: "u8" } as any)).to.throw(
        TypeError,
      );
    });

    it("accepts compiled schemas as composition inputs", () => {
      const left = schema({ left: "u8" });
      const right = schema({ right: "u16" });
      const combined = combine.merge(left, right);
      const value = { left: 1, right: 2 };

      expect(decode(combined, encode(combined, value))).to.deep.equal(value);
    });
  });

  describe("compiled schema immutability", () => {
    it("freezes compiled primitive and helper schemas", () => {
      expect(Object.isFrozen(schema("u8"))).to.equal(true);
      expect(Object.isFrozen(array("u8"))).to.equal(true);
      expect(Object.isFrozen(bitpack(4))).to.equal(true);
      expect(Object.isFrozen(optional("u8"))).to.equal(true);
      expect(Object.isFrozen(bytes)).to.equal(true);
    });

    it("deeply freezes nested compiled schemas and object entries", () => {
      const compiled = schema({ nested: { value: "u8" }, other: "u16" }) as any;

      expect(Object.isFrozen(compiled)).to.equal(true);
      expect(Object.isFrozen(compiled.entries)).to.equal(true);
      for (const entry of compiled.entries) {
        expect(Object.isFrozen(entry)).to.equal(true);
        expect(Object.isFrozen(entry[1])).to.equal(true);
      }

      const nested = compiled.entries.find(([key]: [string, any]) => key === "nested")![1];
      expect(Object.isFrozen(nested.entries)).to.equal(true);
      expect(Object.isFrozen(nested.entries[0])).to.equal(true);
    });

    it("does not retain the original object as a source property", () => {
      const source = { value: "u8" } as const;
      const compiled = schema(source);

      expect(Object.keys(compiled)).to.not.include("source");
      expect(Object.keys(compiled)).to.not.include("schemaSource");
    });
  });

  describe("malformed input targets", () => {
    it("rejects truncated primitive data", () => {
      expect(() => decode("u32", bytesOf(1, 2))).to.throw();
    });

    it("rejects truncated fixed arrays", () => {
      expect(() => decode("u16[2]", bytesOf(1, 0))).to.throw();
    });

    it("rejects dynamic arrays whose declared length exceeds the buffer", () => {
      expect(() => decode("u8[]", bytesOf(5, 0, 0, 0, 1))).to.throw();
    });

    it("rejects length-prefixed bytes with an incomplete payload", () => {
      expect(() => decode(bytes, bytesOf(4, 0, 0, 0, 1, 2))).to.throw();
    });

    it("rejects length-prefixed strings with an incomplete payload", () => {
      expect(() => decode(string.prefixedLength, bytesOf(3, 0, 0, 0, 65))).to.throw();
    });

    it("rejects null-terminated strings without a terminator", () => {
      expect(() => decode(string.nullTerminated, bytesOf(65, 66))).to.throw();
    });

    it("rejects truncated bitpacks", () => {
      expect(() => decode(bitpack(16), bytesOf(0))).to.throw();
    });

    it("rejects truncated optional values", () => {
      expect(() => decode(optional("u32"), bytesOf(1))).to.throw();
    });
  });
});
