import { type CompiledSchema, type Data, type Schema } from "../schema/schema.ts";
export declare const encode: <T extends Schema>(schema: T | CompiledSchema<T>, data: Data<T>) => Uint8Array<ArrayBuffer>;
//# sourceMappingURL=encoder.d.ts.map