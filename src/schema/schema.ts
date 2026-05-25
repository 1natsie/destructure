import {
  coder,
  destructureSimpleSchema,
  PRIMITIVE_TYPES_ARRAY,
  sortObjectEntries,
  textDecoder,
  textEncoder,
} from "../utils/utils.ts";
import type { CompiledSchema, CustomSchemaHandler, OptionalSchema, Schema } from "./types.ts";

type CSchema<T extends Schema = Schema> = CompiledSchema<T>;

const SchemaType = {
  Null: -1,
  Simple: 0,
  Object: 1,
  Tuple: 2,
  Array: 3,
  Optional: 4,
  Custom: 5,
} as const;

const optionalSchemaKey = Symbol("optionalSchema");
const schemaSourceKey = Symbol("schemaSource");

const schemaMap: Map<Schema, CompiledSchema> = new Map();
const schemaSet: Set<CompiledSchema> = new Set();
schemaMap.set(null, Object.freeze({ type: SchemaType.Null, [schemaSourceKey]: null }));

const isCompiledSchema = (value: unknown): value is CSchema => schemaSet.has(value as CSchema);
const isCustomSchema = (value: unknown): value is CustomSchemaHandler => {
  return schemaMap.get(value as CustomSchemaHandler)?.type === SchemaType.Custom;
};

const schema = <T extends Schema>(value: T | CSchema<T>): CSchema<T> => compileSchema(value);
const source = <T extends Schema>(value: CSchema<T>): T => value[schemaSourceKey];
const compileSchema = <T extends Schema>(value: T | CSchema<T>): CSchema<T> => {
  if (schemaMap.has(value as Schema)) return schemaMap.get(value as Schema) as CompiledSchema<T>;
  if (isCompiledSchema(value)) return value as CompiledSchema<T>;
  if (isCustomSchema(value)) return schemaMap.get(value as CustomSchemaHandler) as CSchema<T>;
  let compiled: CompiledSchema<T>;

  if (value === null) compiled = schemaMap.get(null) as CompiledSchema<T>;
  else if (typeof value === "string") {
    const ds = destructureSimpleSchema(value);
    compiled = ds.isArray
      ? {
          type: SchemaType.Array,
          [schemaSourceKey]: value,
          schema: {
            type: SchemaType.Simple,
            [schemaSourceKey]: ds.base,
            base: ds.base,
            byteLength: ds.byteLength,
          },
          count: ds.arrayLength,
        }
      : {
          type: SchemaType.Simple,
          [schemaSourceKey]: value,
          base: ds.base,
          byteLength: ds.byteLength,
        };
  } else if (typeof value === "object") {
    type StackEntry = [CompiledSchema, string | null, Schema];

    compiled = Array.isArray(value)
      ? { type: SchemaType.Tuple, [schemaSourceKey]: value, entries: [] }
      : { type: SchemaType.Object, [schemaSourceKey]: value, entries: [] };
    const stack: StackEntry[] = Array.isArray(value)
      ? value.map<StackEntry>((s) => [compiled, null, s]).reverse()
      : sortObjectEntries(Object.entries(value))
          .map<StackEntry>((s) => [compiled, s[0], s[1]])
          .reverse();

    while (stack.length) {
      const [parent, key, value] = stack.pop()!;
      let compiled: CompiledSchema;

      if (isCompiledSchema(value)) compiled = value;
      else if (schemaMap.has(value)) compiled = schemaMap.get(value)!;
      else if (typeof value === "string") compiled = compileSchema(value);
      else if (value === null) compiled = compileSchema(value);
      else if (isCustomSchema(value)) compiled = compileSchema(value);
      else if (Array.isArray(value)) {
        compiled = { type: SchemaType.Tuple, [schemaSourceKey]: value, entries: [] };
        stack.push(...value.map<StackEntry>((s) => [compiled, null, s]).reverse());
      } else if (typeof value === "object") {
        compiled = { type: SchemaType.Object, [schemaSourceKey]: value, entries: [] };
        stack.push(
          ...sortObjectEntries(Object.entries(value))
            .map<StackEntry>((s) => [compiled, s[0], s[1]])
            .reverse(),
        );
      } else throw new Error("Invalid schema.");

      if (parent.type === SchemaType.Object) key && parent.entries.push([key, compiled]);
      else if (parent.type === SchemaType.Tuple) parent.entries.push(compiled);
    }
  } else throw new Error("Invalid schema.");

  Object.freeze(compiled);
  schemaMap.set(value as Schema, compiled);
  schemaSet.add(compiled);
  return compiled;
};

const array = <T extends Schema>(value: T, count: number = -1): T[] => {
  const compiled = {
    type: SchemaType.Array,
    [schemaSourceKey]: value,
    schema: compileSchema(value),
    count,
  };
  const placeholderSchema: T[] = [];

  Object.freeze(compiled);
  schemaMap.set(placeholderSchema, compiled);
  schemaSet.add(compiled);
  return placeholderSchema;
};

const optional = <T extends Schema>(value: T): OptionalSchema<T> => {
  const placeholderSchema: OptionalSchema<T> = { [optionalSchemaKey]: true, schema: value };
  const compiled = Object.freeze({
    type: SchemaType.Optional,
    [schemaSourceKey]: value,
    schema: compileSchema(value),
  });

  schemaMap.set(placeholderSchema, compiled);
  schemaSet.add(compiled);
  return placeholderSchema;
};

const custom = <T>(handler: CustomSchemaHandler<T>): CustomSchemaHandler<T> => {
  if (
    !(
      typeof handler?.encode === "function" &&
      typeof handler?.decode === "function" &&
      typeof handler?.size === "function" &&
      ("encodeInto" in handler ? typeof handler.encodeInto === "function" : true)
    )
  )
    throw new Error("Invalid custom schema handler.");

  schemaMap.set(
    handler,
    Object.freeze({ type: SchemaType.Custom, [schemaSourceKey]: handler, handler }),
  );
  return handler;
};

const string: CustomSchemaHandler<string> = custom<string>({
  encode: (value) => {
    const encoded = textEncoder.encode(value);
    if (encoded.length > 2 ** 32 - 1) throw new RangeError("Input length exceeds limit.");

    const result = new Uint8Array(encoded.length + 4);

    result.set(encoded, 4);
    result.set(coder.encodeNumber(encoded.length), 0);

    return result;
  },
  decode: (bytes, offset) => {
    const dataLength = bytes.view.getUint32(offset, true);
    const dataOffset = offset + 4;
    return {
      value: textDecoder.decode(bytes.array.subarray(dataOffset, dataOffset + dataLength)),
      nextOffset: offset + 4 + dataLength,
    };
  },
  encodeInto: (buffer, value) => {
    const encoded = textEncoder.encode(value);
    if (encoded.length > 2 ** 32 - 1) throw new RangeError("Input length exceeds limit.");

    buffer.ensureCapacity(encoded.length + 4);
    buffer.view.setUint32(buffer.offset, encoded.length, true);
    buffer.buffer.set(encoded, (buffer.offset += 4));
    buffer.offset += encoded.length;

    return null;
  },
  size: () => ({ value: 4, isVariable: true }),
});

PRIMITIVE_TYPES_ARRAY.map(schema); // Precompile schemas

export type * from "./types.ts";
export { array, custom, isCustomSchema, optional, schema, SchemaType, source, string };
export type { optionalSchemaKey, schemaSourceKey };
