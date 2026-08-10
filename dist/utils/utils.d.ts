import type { SimpleSchema, SimpleSchemaBase } from "../schema/schema.ts";
import type { DestructuredSimpleSchema, GrowingBuffer } from "./types.ts";
export declare const SIMPLE_SCHEMA_BASE_ARRAY: ReadonlyArray<SimpleSchemaBase>;
export declare const SIMPLE_SCHEMA_BASE: ReadonlySet<SimpleSchemaBase>;
export declare const BITLENGTH_REGEX: RegExp;
export declare const SIMPLE_SCHEMA_BASE_REGEX: RegExp;
export declare const textEncoder: TextEncoder;
export declare const textDecoder: TextDecoder;
export declare const coder: {
    encodeNumber: (value: number) => Uint8Array<ArrayBuffer>;
    decodeNumber: (value: ArrayLike<number>) => number;
    encodeString: (value: string) => Uint8Array<ArrayBuffer>;
    decodeString: (x: ArrayLike<number>) => string;
};
export declare const getStringCharCodes: (value: string, guardFn?: (cc: number) => number) => number[];
export declare const destructureSimpleSchema: (schema: SimpleSchema) => DestructuredSimpleSchema;
export declare const sortObjectKeys: (a: PropertyKey, b: PropertyKey) => number;
export declare const sortObjectEntries: <Key extends PropertyKey, Value>(entries: [Key, Value][]) => [Key, Value][];
export declare const createGrowingBuffer: (initialSize?: number, growth?: number) => GrowingBuffer;
export type * from "./types.ts";
//# sourceMappingURL=utils.d.ts.map