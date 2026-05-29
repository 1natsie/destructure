import type { CompiledSchema, CustomSchemaHandler, OptionalSchema, Schema } from "./types.ts";
type CSchema<T extends Schema = Schema> = CompiledSchema<T>;
declare const SchemaType: {
    readonly Null: -1;
    readonly Simple: 0;
    readonly Object: 1;
    readonly Tuple: 2;
    readonly Array: 3;
    readonly Optional: 4;
    readonly Custom: 5;
};
declare const optionalSchemaKey: unique symbol;
declare const schemaSourceKey: unique symbol;
declare const isCustomSchema: (value: unknown) => value is CustomSchemaHandler;
declare const schema: <T extends Schema>(value: T | CSchema<T>) => CSchema<T>;
declare const source: <T extends Schema>(value: CSchema<T>) => T;
declare const array: <T extends Schema>(value: T, count?: number) => T[];
declare const optional: <T extends Schema>(value: T) => OptionalSchema<T>;
declare const custom: <In, Out = In>(handler: CustomSchemaHandler<In, Out>) => CustomSchemaHandler<In, Out>;
declare const bytes: CustomSchemaHandler<ArrayLike<number>, Uint8Array<ArrayBuffer>>;
declare const string: CustomSchemaHandler<string> & {
    nullTerminated: CustomSchemaHandler<string>;
};
export type * from "./types.ts";
export { array, bytes, custom, isCustomSchema, optional, schema, SchemaType, source, string };
export type { optionalSchemaKey, schemaSourceKey };
//# sourceMappingURL=schema.d.ts.map