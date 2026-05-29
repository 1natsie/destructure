import { expect } from "chai";
import { describe, it } from "node:test";

import { decode } from "../src/decoder/decoder.ts";
import { encode } from "../src/encoder/encoder.ts";
import { array, bytes, custom, optional, schema, string, type Data } from "../src/schema/schema.ts";

describe("destructure", () => {
  describe("Primitives", () => {
    it("should encode and decode u8", () => {
      const s = "u8";
      const data: Data.Input<typeof s> = 255;
      const encoded = encode(s, data);
      expect(encoded).to.deep.equal(new Uint8Array([255]));
      expect(decode(s, encoded)).to.deep.equal(data);
    });

    it("should encode and decode i32", () => {
      const s = "i32";
      const data: Data.Input<typeof s> = -123456789;
      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded).to.deep.equal(data);
    });

    it("should encode and decode f64", () => {
      const s = "f64";
      const data: Data.Input<typeof s> = Math.PI;
      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded).to.be.approximately(data, 1e-6);
    });

    it("should encode and decode char", () => {
      const s = "char";
      const data: Data.Input<typeof s> = "A";
      const encoded = encode(s, data);
      expect(encoded).to.deep.equal(new Uint8Array([65]));
      expect(decode(s, encoded)).to.deep.equal(data);
    });
  });

  describe("Arrays", () => {
    it("should encode and decode fixed-size primitive arrays", () => {
      const s = "u8[4]";
      const data: Data.Input<typeof s> = [1, 2, 3, 4];
      const encoded = encode(s, data);
      expect(encoded).to.deep.equal(new Uint8Array([1, 2, 3, 4]));
      expect(decode(s, encoded)).to.deep.equal(data);
    });

    it("should encode and decode dynamic primitive arrays", () => {
      const s = "u16[]";
      const data: Data.Input<typeof s> = [1000, 2000, 3000];
      const encoded = encode(s, data);
      // 4 bytes for length (3) + 3 * 2 bytes = 10 bytes
      expect(encoded.length).to.deep.equal(10);
      expect(decode(s, encoded)).to.deep.equal(data);
    });

    it("should encode and decode complex arrays using array() helper", () => {
      const s = array({ id: "u32", active: "u8" }, 2);
      const data: Data.Input<typeof s> = [
        { id: 1, active: 1 },
        { id: 2, active: 0 },
      ];
      const encoded = encode(s, data);
      expect(decode(s, encoded)).to.deep.equal(data);
    });
  });

  describe("Objects and Tuples", () => {
    it("should handle nested objects with sorted keys", () => {
      const s = schema({
        b: "u8",
        a: {
          z: "f32",
          y: "char",
        },
      });
      const data: Data.Input<typeof s> = {
        b: 42,
        a: { z: 1.5, y: "!" },
      };
      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded).to.deep.equal(data);
    });

    it("should handle tuples", () => {
      const s = schema(["u8", "i32", "char"] as const);
      const data: Data.Input<typeof s> = [255, -1, "X"];
      const encoded = encode(s, data);
      expect(decode(s, encoded)).to.deep.equal(data);
    });
  });

  describe("Optional", () => {
    const s = schema({
      id: "u32",
      metadata: optional("u16"),
      tags: optional(array("char", 3)),
    });

    it("should encode and decode when optional fields are present", () => {
      const data: Data.Input<typeof s> = {
        id: 123,
        metadata: 456,
        tags: ["a", "b", "c"],
      };
      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded).to.deep.equal(data);
    });

    it("should encode and decode when optional fields are missing", () => {
      const data: Data.Input<typeof s> = {
        id: 123,
        // metadata and tags are undefined
      };
      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded.id).to.deep.equal(123);
      expect(decoded.metadata).to.be.undefined;
      expect(decoded.tags).to.be.undefined;
    });
  });

  describe("Custom Handlers", () => {
    it("should handle custom types", () => {
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

      const s = schema({ timestamp: custom(dateHandler) });
      const now = new Date();
      now.setMilliseconds(0); // For precision in simple comparisons
      const data: Data.Input<typeof s> = { timestamp: now };

      const encoded = encode(s, data);
      const decoded = decode(s, encoded);
      expect(decoded.timestamp.getTime()).to.deep.equal(now.getTime());
    });
  });

  describe("String", () => {
    it("should encode and decode a simple string", () => {
      const data = "Hello, World!";
      const encoded = encode(string, data);
      const decoded = decode(string, encoded);
      expect(decoded).to.deep.equal(data);
    });

    it("should handle empty strings", () => {
      const data = "";
      const encoded = encode(string, data);
      const decoded = decode(string, encoded);
      expect(decoded).to.deep.equal(data);
      expect(encoded.length).to.deep.equal(4);
    });

    it("should handle multi-byte characters (UTF-8)", () => {
      const data = "🔥 🚀 🌍";
      const encoded = encode(string, data);
      const decoded = decode(string, encoded);
      expect(decoded).to.deep.equal(data);
    });

    describe("Null-terminated", () => {
      it("should encode and decode a simple null-terminated string", () => {
        const data = "Hello";
        const encoded = encode(string.nullTerminated, data);
        expect(encoded).to.deep.equal(new Uint8Array([72, 101, 108, 108, 111, 0]));
        const decoded = decode(string.nullTerminated, encoded);
        expect(decoded).to.deep.equal(data);
      });

      it("should handle empty null-terminated strings", () => {
        const data = "";
        const encoded = encode(string.nullTerminated, data);
        expect(encoded).to.deep.equal(new Uint8Array([0]));
        const decoded = decode(string.nullTerminated, encoded);
        expect(decoded).to.deep.equal(data);
      });

      it("should handle multi-byte characters (UTF-8) in null-terminated strings", () => {
        const data = "🚀";
        const encoded = encode(string.nullTerminated, data);
        // "🚀" is F0 9F 9A 80
        expect(encoded).to.deep.equal(new Uint8Array([240, 159, 154, 128, 0]));
        const decoded = decode(string.nullTerminated, encoded);
        expect(decoded).to.deep.equal(data);
      });

      it("should throw error if null character is present in string", () => {
        const data = "Hello\0World";
        expect(() => encode(string.nullTerminated, data)).to.throw(
          TypeError,
          "Null terminator within string.",
        );
      });
    });
  });

  describe("Bytes", () => {
    it("should encode and decode Uint8Array", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = encode(bytes, data);
      const decoded = decode(bytes, encoded);
      expect(decoded).to.deep.equal(data);
    });

    it("should encode and decode empty byte array", () => {
      const data = new Uint8Array([]);
      const encoded = encode(bytes, data);
      const decoded = decode(bytes, encoded);
      expect(decoded).to.deep.equal(data);
      expect(encoded.length).to.deep.equal(4);
    });

    it("should handle regular arrays as input", () => {
      const data = [10, 20, 30];
      const encoded = encode(bytes, data);
      const decoded = decode(bytes, encoded);
      expect(decoded).to.deep.equal(new Uint8Array(data));
    });

    it("should throw error for invalid elements", () => {
      const data = [1, 2, 256];
      expect(() => encode(bytes, data)).to.throw(TypeError, "Invalid element in byte array.");
    });
  });

  describe("Null", () => {
    it("should handle null schemas", () => {
      const s = { field: null };
      const data: Data.Input<typeof s> = { field: null };
      const encoded = encode(s, data);
      expect(decode(s, encoded)).to.deep.equal(data);
    });
  });
});
