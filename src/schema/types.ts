import type { GrowingBuffer } from "../utils/utils.ts";
import type { SchemaType as _SchemaTypeMap, optionalSchemaKey, schemaSourceKey } from "./schema.ts";

type KeysWithOptionalSchemas<T extends ObjectSchema> = {
  [K in keyof T]: T[K] extends OptionalSchema<Schema> ? K : never;
}[keyof T];

export type PrimitiveType = "char" | `u${8 | 16 | 32}` | `i${8 | 16 | 32}` | `f${32 | 64}`;
export type PrimitiveTypeMap = {
  char: string;
  u8: number;
  u16: number;
  u32: number;
  i8: number;
  i16: number;
  i32: number;
  f32: number;
  f64: number;
};

export type SchemaTypeMap = typeof _SchemaTypeMap;
export type SchemaType = SchemaTypeMap[keyof SchemaTypeMap];

type CompiledNullSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Null"];
  [schemaSourceKey]: T;
}>;
type CompiledSimpleSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Simple"];
  [schemaSourceKey]: T;
  base: PrimitiveType;
  byteLength: number;
}>;
type CompiledObjectSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Object"];
  [schemaSourceKey]: T;
  entries: [string, CompiledSchema][];
}>;
type CompiledTupleSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Tuple"];
  [schemaSourceKey]: T;
  entries: CompiledSchema[];
}>;
type CompiledArraySchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Array"];
  [schemaSourceKey]: T;
  schema: CompiledSchema;
  count: number;
}>;
type CompiledOptionalSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Optional"];
  [schemaSourceKey]: T;
  schema: CompiledSchema;
}>;
type CompiledCustomSchema<T extends Schema> = Readonly<{
  type: SchemaTypeMap["Custom"];
  [schemaSourceKey]: T;
  handler: CustomSchemaHandler;
}>;
export type CompiledSchema<T extends Schema = Schema> =
  | CompiledNullSchema<T>
  | CompiledSimpleSchema<T>
  | CompiledObjectSchema<T>
  | CompiledTupleSchema<T>
  | CompiledArraySchema<T>
  | CompiledOptionalSchema<T>
  | CompiledCustomSchema<T>;

export type StructDecodeResult<T> = { value: T; nextOffset: number };
export type SizeOfResult = { value: number; isVariable: boolean };
export interface CustomSchemaHandler<InputType = any, OutputType extends any = InputType> {
  encode: (value: InputType) => Uint8Array<ArrayBuffer>;
  encodeInto?: (buffer: GrowingBuffer, value: InputType) => null;
  decode: (
    bytes: { array: Uint8Array<ArrayBuffer>; view: DataView<ArrayBuffer> },
    offset: number,
  ) => StructDecodeResult<OutputType>;
  size: () => SizeOfResult;
}

export type SimpleSchema = `${PrimitiveType}${`[${number | ""}]` | ""}`;
export type ObjectSchema = Readonly<{ [x: string]: Schema }>;
export type TupleSchema = Schema[];
export type OptionalSchema<T extends Schema> = Readonly<{ [optionalSchemaKey]: true; schema: T }>;
export type NullSchema = null;
export type Schema =
  | NullSchema
  | SimpleSchema
  | ObjectSchema
  | TupleSchema
  | CustomSchemaHandler
  | { [schemaSourceKey]: Schema };

type DecodePrimitive<T extends SimpleSchema> = T extends PrimitiveType
  ? PrimitiveTypeMap[T]
  : T extends `${infer PT extends PrimitiveType}[${number | ""}]`
    ? PrimitiveTypeMap[PT][]
    : never;

export namespace Data {
  type DecodeInputTuple<T extends Schema[], Collector extends unknown[] = []> = any[] extends T
    ? T extends (infer ST extends Schema)[]
      ? Data.Input<ST>[]
      : never
    : T extends [infer Schm extends Schema, ...infer Rest extends Schema[]]
      ? DecodeInputTuple<Rest, [...Collector, Data.Input<Schm>]>
      : Collector;

  type DecodeOutputTuple<T extends Schema[], Collector extends unknown[] = []> = any[] extends T
    ? T extends (infer ST extends Schema)[]
      ? Data.Output<ST>[]
      : never
    : T extends [infer Schm extends Schema, ...infer Rest extends Schema[]]
      ? DecodeOutputTuple<Rest, [...Collector, Data.Output<Schm>]>
      : Collector;

  type DecodeInputObject<T extends ObjectSchema> = {
    [K in Exclude<keyof T, KeysWithOptionalSchemas<T>>]: Data.Input<T[K]>;
  } & { [K in KeysWithOptionalSchemas<T>]?: Data.Input<T[K]> };

  type DecodeOutputObject<T extends ObjectSchema> = {
    [K in Exclude<keyof T, KeysWithOptionalSchemas<T>>]: Data.Output<T[K]>;
  } & { [K in KeysWithOptionalSchemas<T>]?: Data.Output<T[K]> };

  export type Input<Schm extends Schema> = Schm extends NullSchema
    ? null
    : Schm extends OptionalSchema<infer T>
      ? Data.Input<T> | undefined
      : Schm extends SimpleSchema
        ? DecodePrimitive<Schm>
        : Schm extends TupleSchema
          ? DecodeInputTuple<Schm>
          : Schm extends ObjectSchema
            ? DecodeInputObject<Schm>
            : Schm extends CustomSchemaHandler<infer InputType, infer _OutputType>
              ? InputType
              : Schm extends CompiledSchema<infer S>
                ? Data.Input<S>
                : never;

  export type Output<Schm extends Schema> = Schm extends NullSchema
    ? null
    : Schm extends OptionalSchema<infer T>
      ? Data.Input<T> | undefined
      : Schm extends SimpleSchema
        ? DecodePrimitive<Schm>
        : Schm extends TupleSchema
          ? DecodeOutputTuple<Schm>
          : Schm extends ObjectSchema
            ? DecodeOutputObject<Schm>
            : Schm extends CustomSchemaHandler<infer _InputType, infer OutputType>
              ? OutputType
              : Schm extends CompiledSchema<infer S>
                ? Data.Input<S>
                : never;
}
