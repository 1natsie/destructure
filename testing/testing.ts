import { decode } from "../src/decoder/decoder.ts";
import { encode } from "../src/encoder/encoder.ts";
import {
  array,
  bytes,
  optional,
  schema,
  source,
  string,
  type Data,
} from "../src/schema/schema.ts";
import { sortObjectEntries } from "../src/utils/utils.ts";

const s = schema({ name: "char[9]", nested: { prop1: "u8", prop2: "i32" } });
const z = schema({
  x: s,
  y: { ...source(s), name: "char[8]" },
  string: [string, array(string, 2)] as const,
  nullTerminated: string.nullTerminated,
  bytes: bytes,
  tuple: ["i8", "i8", { value: "f64" }] as const,
  array: array({ char: "char" }, 5),
  optional: optional("u8"),
});

const data: Data<typeof z> = {
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
const getJSONString = (data: object) => {
  return JSON.stringify(
    Object.fromEntries(sortObjectEntries(Object.entries(data))),
    (_key, value) => (value instanceof Uint8Array ? Array.from(value) : value),
    2,
  );
};

const avg_timings = timings.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
avg_timings[0] /= timings.length;
avg_timings[1] /= timings.length;

console.log({
  encodedSize: encoded.length,
  decodedMatch: getJSONString(data) === getJSONString(decoded),
  encodedData: encoded,
  decodedData: decoded,
  timings: {
    encoding: avg_timings[0],
    decoding: avg_timings[1],
  },
});
