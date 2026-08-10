import {
  coder,
  destructureSimpleSchema,
  sortObjectEntries,
  textDecoder,
  textEncoder,
} from "../utils/utils.ts";
import type {
  BitpackSchema,
  CompiledArraySchema,
  CompiledBitpackSchema,
  CompiledCustomSchema,
  CompiledNullSchema,
  CompiledObjectSchema,
  CompiledOptionalSchema,
  CompiledSchema,
  CompiledTupleSchema,
  CustomSchema,
  CustomSchemaHandler,
  ObjectSchema,
  Schema,
  SchemaOrCompiledSchema,
  TupleSchema,
} from "./types.ts";

const SchemaType = {
  Null: -1,
  Simple: 0,
  Object: 1,
  Tuple: 2,
  Array: 3,
  Bitpack: 4,
  Optional: 5,
  Custom: 6,
} as const;

const MAX_ARRAY_LIKE_LENGTH = 2 ** 32 - 1;

const compiledSchemaKey = Symbol("compiledSchema");
const optionalSchemaKey = Symbol("optionalSchema");
const bitpackSchemaKey = Symbol("bitpackSchema");
const customSchemaKey = Symbol("customSchemaHandler");

const schemaMap: WeakMap<Exclude<Schema, string | null>, CompiledSchema> = new WeakMap();
const compiledNullSchema: CompiledNullSchema = Object.freeze({
  [compiledSchemaKey]: null,
  schemaType: SchemaType.Null,
});

const isCompiledSchema = (value: unknown): value is CompiledSchema => {
  return value != null && typeof value === "object" && compiledSchemaKey in value;
};

const isCustomSchema = (value: unknown): value is CustomSchema => {
  return value != null && typeof value === "object" && customSchemaKey in value;
};

const schema = <T extends Schema>(value: SchemaOrCompiledSchema<T>): CompiledSchema<T> => {
  if (value === null) return compiledNullSchema as CompiledSchema<T>;
  if (isCompiledSchema(value)) return value;

  if (typeof value === "string") {
    const ds = destructureSimpleSchema(value);
    return Object.freeze({
      [compiledSchemaKey]: value,
      schemaType: SchemaType.Simple,
      base: ds.base,
      byteLength: ds.byteLength,
      count: ds.isArray ? ds.arrayLength : 1,
      isArray: ds.isArray,
    });
  }

  if (typeof value === "object") {
    const closingMarker = Symbol("closingMarker");
    const freeze = Object.freeze;
    const push = Function.prototype.call.bind(Array.prototype.push);
    type CompiledGroupingSchema = CompiledObjectSchema | CompiledTupleSchema;
    type StackEntry = [
      CompiledGroupingSchema,
      string | null,
      Schema | CompiledSchema | typeof closingMarker,
    ];

    const result: CompiledGroupingSchema = Array.isArray(value)
      ? { [compiledSchemaKey]: compiledSchemaKey, schemaType: SchemaType.Tuple, entries: [] }
      : { [compiledSchemaKey]: compiledSchemaKey, schemaType: SchemaType.Object, entries: [] };
    const stack: StackEntry[] = Array.isArray(value)
      ? value.map<StackEntry>((s) => [result, null, s]).reverse()
      : sortObjectEntries(Object.entries(value))
          .map<StackEntry>((s) => [result, s[0], s[1]])
          .reverse();

    while (stack.length) {
      const [parent, key, value] = stack.pop()!;
      let compiled: CompiledSchema;

      if (value === closingMarker) {
        freeze(parent.entries);
        freeze(parent);
        continue;
      }

      if (isCompiledSchema(value)) compiled = value;
      else if (value === null) compiled = compiledNullSchema;
      else if (typeof value === "string") compiled = schema(value);
      else if (isCustomSchema(value)) compiled = schema(value);
      else if (schemaMap.has(value)) compiled = schemaMap.get(value)!;
      else if (Array.isArray(value)) {
        compiled = {
          [compiledSchemaKey]: compiledSchemaKey,
          schemaType: SchemaType.Tuple,
          entries: [],
        };

        stack.push([compiled as CompiledTupleSchema, null, closingMarker]);
        stack.push(
          ...value.map<StackEntry>((s) => [compiled as CompiledTupleSchema, null, s]).reverse(),
        );
      } else if (typeof value === "object") {
        compiled = {
          [compiledSchemaKey]: compiledSchemaKey,
          schemaType: SchemaType.Object,
          entries: [],
        };

        stack.push([compiled as CompiledObjectSchema, null, closingMarker]);
        stack.push(
          ...sortObjectEntries(Object.entries(value))
            .map<StackEntry>((s) => [compiled as CompiledObjectSchema, s[0], s[1]])
            .reverse(),
        );
      } else throw new Error("Invalid schema.");
      if (parent.schemaType === SchemaType.Object)
        key && push(parent.entries, freeze([key, compiled]));
      else if (parent.schemaType === SchemaType.Tuple) push(parent.entries, compiled);
    }

    freeze(result.entries);
    freeze(result);

    schemaMap.set(value, result);
    return result as CompiledSchema<T>;
  }

  throw new TypeError("Invalid schema.");
};

const array = <T extends Schema>(
  value: SchemaOrCompiledSchema<T>,
  count: number = -1,
): CompiledSchema<T[]> => {
  if (!Number.isSafeInteger(count)) throw new TypeError("Array count must be a safe integer.");
  if (count !== -1 && !(count >= 0 && count <= MAX_ARRAY_LIKE_LENGTH)) {
    throw new RangeError("Array count must be between 0 and the maximum length.");
  }

  const compiled: CompiledArraySchema<T[]> = {
    [compiledSchemaKey]: compiledSchemaKey,
    schemaType: SchemaType.Array,
    schema: schema(value),
    count,
  };

  return Object.freeze(compiled);
};

const bitpack = <T extends number>(bitCount: T): CompiledBitpackSchema<BitpackSchema<T>> => {
  if (!Number.isSafeInteger(bitCount) || bitCount < 1) {
    throw new TypeError("Bitpack bit count must be a safe positive integer.");
  }

  const compiled: CompiledBitpackSchema<BitpackSchema<T>> = {
    [compiledSchemaKey]: compiledSchemaKey,
    schemaType: SchemaType.Bitpack,
    bitCount: bitCount,
  };

  return Object.freeze(compiled);
};

const optional = <T extends Schema>(
  value: SchemaOrCompiledSchema<T>,
): CompiledOptionalSchema<T> => {
  const compiled: CompiledOptionalSchema<T> = {
    [compiledSchemaKey]: compiledSchemaKey,
    schemaType: SchemaType.Optional,
    schema: schema(value),
  };

  return Object.freeze(compiled);
};

const combine: {
  readonly append: <A extends ObjectSchema, B extends ObjectSchema>(
    a: SchemaOrCompiledSchema<A>,
    b: SchemaOrCompiledSchema<B>,
  ) => CompiledObjectSchema<Omit<A, keyof B> & B>;
  readonly augment: <A extends ObjectSchema, B extends ObjectSchema>(
    a: SchemaOrCompiledSchema<A>,
    b: SchemaOrCompiledSchema<B>,
  ) => CompiledObjectSchema<A & Omit<B, keyof A>>;
  readonly merge: <A extends ObjectSchema, B extends ObjectSchema>(
    a: SchemaOrCompiledSchema<A>,
    b: SchemaOrCompiledSchema<B>,
  ) => CompiledObjectSchema<Omit<A, keyof B> & B>;
  readonly concatenate: <A extends TupleSchema, B extends TupleSchema>(
    a: SchemaOrCompiledSchema<A>,
    b: SchemaOrCompiledSchema<B>,
  ) => CompiledTupleSchema<[...A, ...B]>;
} = Object.freeze({
  append: ((
    a: SchemaOrCompiledSchema<ObjectSchema>,
    b: SchemaOrCompiledSchema<ObjectSchema>,
  ): CompiledObjectSchema => {
    const aCompiled = schema(a);
    const bCompiled = schema(b);

    if (aCompiled.schemaType === SchemaType.Object && bCompiled.schemaType === SchemaType.Object) {
      const entries: Map<string, CompiledSchema> = new Map();

      for (const entry of aCompiled.entries) entries.set(entry[0], entry[1]);
      for (const entry of bCompiled.entries) {
        if (!entries.has(entry[0])) entries.set(entry[0], entry[1]);
        else
          throw new ReferenceError(
            `The key "${entry[0]}" already exists as an entry in the object.`,
          );
      }

      return Object.freeze({
        [compiledSchemaKey]: compiledSchemaKey,
        schemaType: SchemaType.Object,
        entries: Object.freeze(
          sortObjectEntries([...entries].map(Object.freeze) as [string, CompiledSchema][]),
        ),
      }) as CompiledObjectSchema;
    }

    throw new TypeError("Schema type mismatch. Both schemas must be of the object schema type.");
  }) as (typeof combine)["append"],
  augment: ((
    a: SchemaOrCompiledSchema<ObjectSchema>,
    b: SchemaOrCompiledSchema<ObjectSchema>,
  ): CompiledObjectSchema => {
    const aCompiled = schema(a);
    const bCompiled = schema(b);

    if (aCompiled.schemaType === SchemaType.Object && bCompiled.schemaType === SchemaType.Object) {
      const entries: Map<string, CompiledSchema> = new Map();

      for (const entry of aCompiled.entries) entries.set(entry[0], entry[1]);
      for (const entry of bCompiled.entries)
        !entries.has(entry[0]) && entries.set(entry[0], entry[1]);

      return Object.freeze({
        [compiledSchemaKey]: compiledSchemaKey,
        schemaType: SchemaType.Object,
        entries: Object.freeze(
          sortObjectEntries([...entries].map(Object.freeze) as [string, CompiledSchema][]),
        ),
      }) as CompiledObjectSchema;
    }

    throw new TypeError("Schema type mismatch. Both schemas must be of the object schema type.");
  }) as (typeof combine)["augment"],
  merge: ((
    a: SchemaOrCompiledSchema<ObjectSchema>,
    b: SchemaOrCompiledSchema<ObjectSchema>,
  ): CompiledObjectSchema => {
    const aCompiled = schema(a);
    const bCompiled = schema(b);

    if (aCompiled.schemaType === SchemaType.Object && bCompiled.schemaType === SchemaType.Object) {
      const entries: Map<string, CompiledSchema> = new Map();

      for (const entry of aCompiled.entries) entries.set(entry[0], entry[1]);
      for (const entry of bCompiled.entries) entries.set(entry[0], entry[1]);

      return Object.freeze({
        [compiledSchemaKey]: compiledSchemaKey,
        schemaType: SchemaType.Object,
        entries: Object.freeze(
          sortObjectEntries([...entries].map(Object.freeze) as [string, CompiledSchema][]),
        ),
      }) as CompiledObjectSchema;
    }

    throw new TypeError("Schema type mismatch. Both schemas must be of the object schema type.");
  }) as (typeof combine)["merge"],
  concatenate: ((
    a: SchemaOrCompiledSchema<TupleSchema>,
    b: SchemaOrCompiledSchema<TupleSchema>,
  ): CompiledTupleSchema => {
    const aCompiled = schema(a);
    const bCompiled = schema(b);

    if (aCompiled.schemaType === SchemaType.Tuple && bCompiled.schemaType === SchemaType.Tuple) {
      return Object.freeze({
        [compiledSchemaKey]: compiledSchemaKey,
        schemaType: SchemaType.Tuple,
        entries: Object.freeze([...aCompiled.entries, ...bCompiled.entries]),
      }) as CompiledTupleSchema;
    }

    throw new TypeError("Schema type mismatch. Both schemas must be of the tuple schema type.");
  }) as (typeof combine)["concatenate"],
});

const custom = <In, Out = In>(
  handler: CustomSchemaHandler<In, Out>,
): CompiledCustomSchema<CustomSchema<CustomSchemaHandler<In, Out>>> => {
  if (!(
    typeof handler?.encode === "function" &&
    typeof handler?.decode === "function" &&
    typeof handler?.size === "function" &&
    ("encodeInto" in handler && handler.encodeInto != null
      ? typeof handler.encodeInto === "function"
      : true)
  ))
    throw new Error("Invalid custom schema handler.");

  const compiled: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<In, Out>>> = {
    [compiledSchemaKey]: compiledSchemaKey,
    schemaType: SchemaType.Custom,
    handler: {
      [customSchemaKey]: customSchemaKey,
      encode: handler.encode,
      decode: handler.decode,
      size: handler.size,
      encodeInto: handler.encodeInto ?? null,
    },
  };

  Object.freeze(compiled.handler);
  return Object.freeze(compiled);
};

const bytes: CompiledCustomSchema<
  CustomSchema<CustomSchemaHandler<ArrayLike<number>, Uint8Array<ArrayBuffer>>>
> = custom<ArrayLike<number>, Uint8Array<ArrayBuffer>>({
  encode: (value) => {
    if (value.length > MAX_ARRAY_LIKE_LENGTH) {
      throw new RangeError("Input length exceeds limit.");
    }

    for (let i = 0; i < value.length; i++) {
      const num = value[i]!;
      if (Number.isSafeInteger(num) && num >= 0 && num <= 255) continue;
      throw new TypeError("Invalid element in byte array.");
    }

    const result = new Uint8Array(value.length + 4);
    result.set(coder.encodeNumber(value.length), 0);
    result.set(value, 4);

    return result;
  },
  encodeInto: (buffer, value) => {
    for (let i = 0; i < value.length; i++) {
      const num = value[i]!;
      if (Number.isSafeInteger(num) && num >= 0 && num <= 255) continue;
      throw new TypeError("Invalid element in byte array.");
    }

    buffer.ensureCapacity(value.length + 4);
    buffer.view.setUint32(buffer.offset, value.length, true);
    buffer.buffer.set(value, (buffer.offset += 4));
    buffer.offset += value.length;

    return null;
  },
  decode: (bytes, offset) => {
    const length = bytes.view.getUint32(offset, true);
    const dataOffset = offset + 4;

    if (dataOffset + length > bytes.array.length) {
      throw new RangeError("Insufficient data. Unexpected end of data.");
    }

    return {
      value: bytes.array.slice(dataOffset, dataOffset + length),
      nextOffset: dataOffset + length,
    };
  },
  size: () => ({ min: 4, max: MAX_ARRAY_LIKE_LENGTH + 4 }),
});

const string: {
  readonly prefixedLength: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<string>>>;
  readonly nullTerminated: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<string>>>;
} = Object.freeze({
  prefixedLength: custom<string>({
    encode: (value) => {
      const encoded = textEncoder.encode(value);
      if (encoded.length > MAX_ARRAY_LIKE_LENGTH) {
        throw new RangeError("Input length exceeds limit.");
      }

      const result = new Uint8Array(encoded.length + 4);

      result.set(encoded, 4);
      result.set(coder.encodeNumber(encoded.length), 0);

      return result;
    },
    decode: (bytes, offset) => {
      const dataLength = bytes.view.getUint32(offset, true);
      const dataOffset = offset + 4;

      if (dataOffset + dataLength > bytes.array.length) {
        throw new RangeError("Insufficient data. Unexpected end of data.");
      }

      return {
        value: textDecoder.decode(bytes.array.subarray(dataOffset, dataOffset + dataLength)),
        nextOffset: dataOffset + dataLength,
      };
    },
    encodeInto: (buffer, value) => {
      const encoded = textEncoder.encode(value);
      if (encoded.length > MAX_ARRAY_LIKE_LENGTH) {
        throw new RangeError("Input length exceeds limit.");
      }

      buffer.ensureCapacity(encoded.length + 4);
      buffer.view.setUint32(buffer.offset, encoded.length, true);
      buffer.buffer.set(encoded, (buffer.offset += 4));
      buffer.offset += encoded.length;

      return null;
    },
    size: () => ({ min: 4, max: MAX_ARRAY_LIKE_LENGTH + 4 }),
  }),
  nullTerminated: custom<string>({
    encode: (value) => {
      const encoded = textEncoder.encode(value);
      const result = new Uint8Array(encoded.length + 1);

      result[encoded.length] = 0;
      for (let i = 0; i < encoded.length; i++) {
        if (encoded[i] !== 0) result[i] = encoded[i]!;
        else throw new TypeError("Null terminator within string.");
      }

      return result;
    },
    encodeInto: (buffer, value) => {
      const encoded = textEncoder.encode(value);
      if (encoded.length > MAX_ARRAY_LIKE_LENGTH) {
        throw new RangeError("Input length exceeds limit.");
      }

      const result = new Uint8Array(encoded.length + 1);

      result[encoded.length] = 0;
      for (let i = 0; i < encoded.length; i++) {
        if (encoded[i] !== 0) result[i] = encoded[i]!;
        else throw new TypeError("Null terminator within string.");
      }

      buffer.ensureCapacity(result.length);
      buffer.buffer.set(result, buffer.offset);
      buffer.offset += result.length;

      return null;
    },
    decode: (bytes, offset) => {
      let endOffset = offset;

      while (endOffset < bytes.array.length && bytes.array[endOffset] !== 0) endOffset++;
      if (!(endOffset < bytes.array.length && bytes.array[endOffset] === 0)) {
        throw new RangeError("Missing null terminator. Unexpected end of data.");
      }

      return {
        value: textDecoder.decode(bytes.array.subarray(offset, endOffset)),
        nextOffset: endOffset + 1,
      };
    },
    size: () => ({ min: 1, max: MAX_ARRAY_LIKE_LENGTH + 1 }),
  }),
});

export * from "./types.ts";
export {
  array,
  bitpack,
  bytes,
  combine,
  custom,
  MAX_ARRAY_LIKE_LENGTH,
  optional,
  schema,
  SchemaType,
  string,
};
export type { bitpackSchemaKey, compiledSchemaKey, customSchemaKey, optionalSchemaKey };
