import type { PrimitiveType, SimpleSchema } from "../schema/schema.ts";
import type { DestructuredSimpleSchema, GrowingBuffer } from "./types.ts";
export declare const PRIMITIVE_TYPES_ARRAY: ReadonlyArray<PrimitiveType>;
export declare const PRIMITIVE_TYPES: ReadonlySet<PrimitiveType>;
export declare const BITLENGTH_REGEX: RegExp;
export declare const PRIMITIVE_TYPE_REGEX: RegExp;
export declare const textEncoder: TextEncoder;
export declare const textDecoder: TextDecoder;
export declare const coder: {
    encodeNumber: (value: number) => Uint8Array<ArrayBuffer>;
    decodeNumber: (value: ArrayLike<number>) => number;
    encodeString: (value: string) => Uint8Array<ArrayBuffer>;
    decodeString: (x: ArrayLike<number>) => string;
};
export declare const getStringCodePoints: (value: string, guardFn?: (cp: number) => number) => number[];
export declare const destructureSimpleSchema: (schema: SimpleSchema) => DestructuredSimpleSchema;
export declare const sortObjectKeys: (a: PropertyKey, b: PropertyKey) => number;
export declare const sortObjectEntries: <Key extends PropertyKey, Value>(entries: [Key, Value][]) => [Key, Value][];
export declare const createGrowingBuffer: (initialSize?: number, growth?: number) => GrowingBuffer;
export type * from "./types.ts";
//# sourceMappingURL=utils.d.ts.map