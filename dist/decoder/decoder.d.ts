import { type Data, type Schema, type SchemaOrCompiledSchema } from "../schema/schema.ts";
export declare const decode: <T extends Schema>(schema: SchemaOrCompiledSchema<T>, buffer: Uint8Array<ArrayBuffer>, offset?: number) => Data.Output<T>;
//# sourceMappingURL=decoder.d.ts.map