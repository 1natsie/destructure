import type { BitpackSchema, CompiledBitpackSchema, CompiledCustomSchema, CompiledObjectSchema, CompiledOptionalSchema, CompiledSchema, CompiledTupleSchema, CustomSchema, CustomSchemaHandler, ObjectSchema, Schema, SchemaOrCompiledSchema, TupleSchema } from "./types.ts";
declare const SchemaType: {
    readonly Null: -1;
    readonly Simple: 0;
    readonly Object: 1;
    readonly Tuple: 2;
    readonly Array: 3;
    readonly Bitpack: 4;
    readonly Optional: 5;
    readonly Custom: 6;
};
declare const MAX_ARRAY_LIKE_LENGTH: number;
declare const compiledSchemaKey: unique symbol;
declare const optionalSchemaKey: unique symbol;
declare const bitpackSchemaKey: unique symbol;
declare const customSchemaKey: unique symbol;
declare const schema: <T extends Schema>(value: SchemaOrCompiledSchema<T>) => CompiledSchema<T>;
declare const array: <T extends Schema>(value: SchemaOrCompiledSchema<T>, count?: number) => CompiledSchema<T[]>;
declare const bitpack: <T extends number>(bitCount: T) => CompiledBitpackSchema<BitpackSchema<T>>;
declare const optional: <T extends Schema>(value: SchemaOrCompiledSchema<T>) => CompiledOptionalSchema<T>;
declare const combine: {
    readonly append: <A extends ObjectSchema, B extends ObjectSchema>(a: SchemaOrCompiledSchema<A>, b: SchemaOrCompiledSchema<B>) => CompiledObjectSchema<Omit<A, keyof B> & B>;
    readonly augment: <A extends ObjectSchema, B extends ObjectSchema>(a: SchemaOrCompiledSchema<A>, b: SchemaOrCompiledSchema<B>) => CompiledObjectSchema<A & Omit<B, keyof A>>;
    readonly merge: <A extends ObjectSchema, B extends ObjectSchema>(a: SchemaOrCompiledSchema<A>, b: SchemaOrCompiledSchema<B>) => CompiledObjectSchema<Omit<A, keyof B> & B>;
    readonly concatenate: <A extends TupleSchema, B extends TupleSchema>(a: SchemaOrCompiledSchema<A>, b: SchemaOrCompiledSchema<B>) => CompiledTupleSchema<[...A, ...B]>;
};
declare const custom: <In, Out = In>(handler: CustomSchemaHandler<In, Out>) => CompiledCustomSchema<CustomSchema<CustomSchemaHandler<In, Out>>>;
declare const bytes: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<ArrayLike<number>, Uint8Array<ArrayBuffer>>>>;
declare const string: {
    readonly prefixedLength: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<string>>>;
    readonly nullTerminated: CompiledCustomSchema<CustomSchema<CustomSchemaHandler<string>>>;
};
export * from "./types.ts";
export { array, bitpack, bytes, combine, custom, MAX_ARRAY_LIKE_LENGTH, optional, schema, SchemaType, string, };
export type { bitpackSchemaKey, compiledSchemaKey, customSchemaKey, optionalSchemaKey };
//# sourceMappingURL=schema.d.ts.map