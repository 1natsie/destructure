import type { ArrayOf, GrowingBuffer } from "../utils/utils.ts";
import type {
  SchemaType as _SchemaType,
  bitpackSchemaKey,
  compiledSchemaKey,
  customSchemaKey,
  optionalSchemaKey,
} from "./schema.ts";

type ValueOf<T> = T[keyof T];

type SchemaType = typeof _SchemaType;
type SizeRange = { min: number; max: number };
type DecodeResult<T> = { value: T; nextOffset: number };

interface _SimpleSchemaBase {
  char: "char";
  unsigned: `u${8 | 16 | 32 | 64 | 128}`;
  signed: `i${8 | 16 | 32 | 64 | 128}`;
  float: `f${32 | 64}`;
}

type SimpleSchemaBase = ValueOf<_SimpleSchemaBase>;
type _SimpleSchemaTypeMap = {
  Input: {
    char: string;
    u8: number;
    u16: number;
    u32: number;
    u64: number | bigint | [number, number];
    u128: number | bigint | [number, number, number, number];
    i8: number;
    i16: number;
    i32: number;
    i64: number | bigint | [number, number];
    i128: number | bigint | [number, number, number, number];
    f32: number;
    f64: number;
  };
  Output: {
    char: string;
    u8: number;
    u16: number;
    u32: number;
    u64: bigint;
    u128: bigint;
    i8: number;
    i16: number;
    i32: number;
    i64: bigint;
    i128: bigint;
    f32: number;
    f64: number;
  };
};

type SimpleSchema = `${SimpleSchemaBase}${`[${number | ""}]` | ""}`;
type ObjectSchema = { [x: string]: Schema | CompiledSchema };
type TupleSchema = SchemaOrCompiledSchema[];
type NullSchema = null;

type OptionalSchema<T extends Schema = Schema> = { [optionalSchemaKey]: T | true };
type BitpackSchema<T extends number = number> = { [bitpackSchemaKey]: T | true };
type CustomSchema<T extends CustomSchemaHandler = CustomSchemaHandler> = {
  [customSchemaKey]: T | true;
} & T;

interface CustomSchemaHandler<InputType = any, OutputType extends any = InputType> {
  encode: (value: InputType) => Uint8Array<ArrayBuffer>;
  encodeInto?: ((buffer: GrowingBuffer, value: InputType) => null) | null;
  decode: (
    bytes: { array: Uint8Array<ArrayBufferLike>; view: DataView<ArrayBufferLike> },
    offset: number,
  ) => DecodeResult<OutputType>;
  size: () => SizeRange;
}

interface CompiledSchemaBase<T extends Schema = Schema> {
  readonly [compiledSchemaKey]: T | typeof compiledSchemaKey;
  readonly schemaType: SchemaType[keyof SchemaType];
}

interface CompiledSimpleSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Simple"];
  readonly base: SimpleSchemaBase;
  readonly byteLength: number;
  readonly count: number;
  readonly isArray: boolean;
}

interface CompiledObjectSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Object"];
  readonly entries: readonly [string, CompiledSchema][];
}

interface CompiledTupleSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Tuple"];
  readonly entries: readonly CompiledSchema[];
}

interface CompiledNullSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Null"];
}

interface CompiledArraySchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Array"];
  readonly schema: CompiledSchema;
  readonly count: number;
}

interface CompiledOptionalSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Optional"];
  readonly schema: CompiledSchema<T>;
}

interface CompiledBitpackSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Bitpack"];
  readonly bitCount: number;
}

interface CompiledCustomSchema<T extends Schema = Schema> extends CompiledSchemaBase<T> {
  readonly schemaType: SchemaType["Custom"];
  readonly handler: {
    [customSchemaKey]: typeof customSchemaKey;
  } & CustomSchemaHandler;
}

type SchemaOrCompiledSchema<T extends Schema = Schema> = T | CompiledSchema<T>;
type Schema = SimpleSchema | ObjectSchema | TupleSchema | NullSchema | CustomSchema;
type CompiledSchema<T extends Schema = Schema> =
  | CompiledNullSchema<T>
  | CompiledSimpleSchema<T>
  | CompiledObjectSchema<T>
  | CompiledTupleSchema<T>
  | CompiledArraySchema<T>
  | CompiledBitpackSchema<T>
  | CompiledOptionalSchema<T>
  | CompiledCustomSchema<T>;

namespace Data {
  type KeysWithOptionalSchemas<T extends ObjectSchema> = {
    [K in keyof T]: T[K] extends OptionalSchema | CompiledOptionalSchema ? K : never;
  }[keyof T];

  type DecodeInputSimple<T extends SimpleSchema> = T extends SimpleSchemaBase
    ? _SimpleSchemaTypeMap["Input"][T]
    : T extends `${infer PT extends SimpleSchemaBase}[${number | ""}]`
      ? _SimpleSchemaTypeMap["Input"][PT][]
      : never;

  type DecodeOutputSimple<T extends SimpleSchema> = T extends SimpleSchemaBase
    ? _SimpleSchemaTypeMap["Output"][T]
    : T extends `${infer PT extends SimpleSchemaBase}[${number | ""}]`
      ? _SimpleSchemaTypeMap["Output"][PT][]
      : never;

  type DecodeInputTuple<
    T extends SchemaOrCompiledSchema[],
    Collector extends unknown[] = [],
  > = any[] extends T
    ? T extends (infer ST extends SchemaOrCompiledSchema)[]
      ? Data.Input<ST>[]
      : never
    : T extends [
          infer Schm extends SchemaOrCompiledSchema,
          ...infer Rest extends SchemaOrCompiledSchema[],
        ]
      ? DecodeInputTuple<Rest, [...Collector, Data.Input<Schm>]>
      : Collector;

  type DecodeOutputTuple<
    T extends SchemaOrCompiledSchema[],
    Collector extends unknown[] = [],
  > = any[] extends T
    ? T extends (infer ST extends SchemaOrCompiledSchema)[]
      ? Data.Output<ST>[]
      : never
    : T extends [
          infer Schm extends SchemaOrCompiledSchema,
          ...infer Rest extends SchemaOrCompiledSchema[],
        ]
      ? DecodeOutputTuple<Rest, [...Collector, Data.Output<Schm>]>
      : Collector;

  type DecodeInputObject<T extends ObjectSchema> = {
    [K in Exclude<keyof T, KeysWithOptionalSchemas<T>>]: Data.Input<T[K]>;
  } & { [K in KeysWithOptionalSchemas<T>]?: Data.Input<T[K]> };

  type DecodeOutputObject<T extends ObjectSchema> = {
    [K in Exclude<keyof T, KeysWithOptionalSchemas<T>>]: Data.Output<T[K]>;
  } & { [K in KeysWithOptionalSchemas<T>]: NonNullable<Data.Output<T[K]>> | null };

  export type ExtractSchema<T extends Schema | CompiledSchema> = T extends Schema
    ? T
    : T extends CompiledSchema<infer Schm>
      ? Schm
      : never;

  export type Input<SchmOrCSchm extends SchemaOrCompiledSchema> =
    ExtractSchema<SchmOrCSchm> extends infer Schm
      ? Schm extends NullSchema
        ? null
        : Schm extends OptionalSchema<infer T>
          ? NonNullable<Data.Input<T>> | null
          : Schm extends SimpleSchema
            ? DecodeInputSimple<Schm>
            : Schm extends BitpackSchema<infer T>
              ? ArrayOf<boolean, T>
              : Schm extends TupleSchema
                ? DecodeInputTuple<Schm>
                : Schm extends ObjectSchema
                  ? DecodeInputObject<Schm>
                  : Schm extends CustomSchemaHandler<infer InputType, infer _OutputType>
                    ? InputType
                    : Schm extends CompiledSchema<infer S>
                      ? Data.Input<S>
                      : never
      : never;

  export type Output<SchmOrCSchm extends Schema | CompiledSchema> =
    ExtractSchema<SchmOrCSchm> extends infer Schm
      ? Schm extends NullSchema
        ? null
        : Schm extends OptionalSchema<infer T>
          ? NonNullable<Data.Output<T>> | null
          : Schm extends SimpleSchema
            ? DecodeOutputSimple<Schm>
            : Schm extends BitpackSchema<infer T>
              ? ArrayOf<boolean, T>
              : Schm extends TupleSchema
                ? DecodeOutputTuple<Schm>
                : Schm extends ObjectSchema
                  ? DecodeOutputObject<Schm>
                  : Schm extends CustomSchemaHandler<infer _InputType, infer OutputType>
                    ? OutputType
                    : Schm extends CompiledSchema<infer S>
                      ? Data.Output<S>
                      : never
      : never;
}

export type {
  BitpackSchema,
  CompiledArraySchema,
  CompiledBitpackSchema,
  CompiledCustomSchema,
  CompiledNullSchema,
  CompiledObjectSchema,
  CompiledOptionalSchema,
  CompiledSchema,
  CompiledSimpleSchema,
  CompiledTupleSchema,
  CustomSchema,
  CustomSchemaHandler,
  Data,
  DecodeResult,
  NullSchema,
  ObjectSchema,
  OptionalSchema,
  Schema,
  SchemaOrCompiledSchema,
  SchemaType,
  SimpleSchema,
  SimpleSchemaBase,
  SizeRange,
  TupleSchema,
};
