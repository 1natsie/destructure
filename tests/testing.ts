import { decode } from "../src/decoder/decoder.ts";
import { encode } from "../src/encoder/encoder.ts";
import {
  array,
  bitpack,
  bytes,
  combine,
  optional,
  schema,
  string,
  type Data,
} from "../src/schema/schema.ts";

const s = schema({ name: "char[9]", nested: { prop1: "u8", prop2: "i32" } });
const z = schema({
  x: s,
  y: combine.augment(combine.merge(s, { name: "char[8]" }), { extra: optional("f32") }),
  string: [string.prefixedLength, array(string.prefixedLength, 2)] as const,
  nullTerminated: string.nullTerminated,
  bytes: bytes,
  tuple: ["i8", "i8", { value: "f64" }] as const,
  array: array({ char: "char" }, 5),
  optional: optional("u8"),
  packed: bitpack(10),
  largeint: "i128",
  multi16: "u16[16]",
});

const data: Data.Input<typeof z> = {
  x: {
    name: Array.from("Anonymous"),
    nested: {
      prop1: 215,
      prop2: 89,
    },
  },
  y: {
    name: Array.from("Somebody"),
    nested: {
      prop1: 87,
      prop2: 603,
    },
  },
  tuple: [-25, 49, { value: 3.14159 }],
  array: [{ char: "h" }, { char: "e" }, { char: "l" }, { char: "l" }, { char: "o" }],
  optional: 7,
  string: ["These", ["are", "strings!"]],
  nullTerminated: "This is null-terminated",
  bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  packed: [false, true, false, true, true, false, true, true, true, false],
  largeint: 1294451n,
  multi16: new Array(16).fill(0).map((_, i) => i),
};

for (let i = 0; i < 100; i++) decode(z, encode(z, data));

const timings: [number, number][] = [];
for (let i = 0; i < 100; i++) {
  const encodeStart = performance.now();
  const encoded = encode(z, data);
  const encodeDur = performance.now() - encodeStart;
  const decodeStart = performance.now();
  const decoded = decode(z, encoded);
  const decodeDur = performance.now() - decodeStart;
  timings.push([encodeDur, decodeDur]);
}

const encoded = encode(z, data);
const decoded = decode(z, encoded);
const isEquivalentData = (a: Record<string, any>, b: Record<string, any>) => {
  const allKeys: Set<string> = new Set();

  for (const key of Object.keys(a)) allKeys.add(key);
  for (const key of Object.keys(b)) allKeys.add(key);

  for (const key of allKeys) {
    if (a[key] == null && b[key] == null) continue;
    if (typeof a[key] !== typeof b[key]) return false;

    switch (typeof a[key]) {
      case "object": {
        if (a[key] == null || b[key] == null) return false;
        if (!isEquivalentData(a[key], b[key])) return false;
        break;
      }
      default: {
        if (a[key] !== b[key]) return false;
        break;
      }
    }
  }

  return true;
};

const avg_timings = timings.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
avg_timings[0] /= timings.length;
avg_timings[1] /= timings.length;

console.log({
  encodedSize: encoded.length,
  decodedMatch: isEquivalentData(data, decoded),
  encodedData: encoded,
  decodedData: decoded,
  timings: {
    encoding: avg_timings[0],
    decoding: avg_timings[1],
  },
});
