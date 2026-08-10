import {
  type CompiledSchema,
  type Data,
  type Schema,
  SchemaType,
  schema as _schema,
} from "../schema/schema.ts";
import { createGrowingBuffer, getStringCharCodes } from "../utils/utils.ts";

const dvMethodMap = {
  u8: DataView.prototype.setUint8,
  u16: DataView.prototype.setUint16,
  u32: DataView.prototype.setUint32,
  i8: DataView.prototype.setInt8,
  i16: DataView.prototype.setInt16,
  i32: DataView.prototype.setInt32,
  f32: DataView.prototype.setFloat32,
  f64: DataView.prototype.setFloat64,
};

const toArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

const getBigInt = (value: number | bigint | number[], segmentCount: number): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (!Array.isArray(value)) throw new Error("value must be a number, bigint, or array.");
  if (value.length !== segmentCount) {
    throw new Error(`value must be an array of length ${segmentCount}.`);
  }

  let result = 0n;
  for (let i = value.length - 1; i >= 0; i--)
    result = (result << 32n) | (BigInt(value[i]!) & 0xffffffffn);

  return result;
};

export const encode = <T extends Schema>(
  schema: T | CompiledSchema<T>,
  data: Data.Input<T>,
): Uint8Array<ArrayBuffer> => {
  type StackEntry = [schema: CompiledSchema, payload: any, data: Record<string, any>];

  const buffer = createGrowingBuffer();
  const stack: StackEntry[] = [[_schema(schema), data, {}]];

  while (stack.length) {
    const [schema, payload, data] = stack.pop()!;
    switch (schema.schemaType) {
      case SchemaType.Null: {
        break;
      }
      case SchemaType.Simple: {
        if (schema.isArray && !Array.isArray(payload)) {
          throw new TypeError(
            `Invalid data. Data must be an array for schema: ${schema.base}[${schema.count}].`,
          );
        }

        switch (schema.base) {
          case "char": {
            const _payload = Array.from(payload).flatMap((p) =>
              getStringCharCodes(p as string, (c) => {
                if (c > 255)
                  throw new TypeError("char data must be a string with one unicode scalar value.");
                return c;
              }),
            );

            let count: number;
            if (schema.count === -1) {
              buffer.ensureCapacity(4 + schema.byteLength * _payload.length);
              buffer.view.setUint32(buffer.offset, _payload.length, true);
              buffer.offset += 4;
              count = _payload.length;
            } else {
              if (_payload.length !== schema.count) {
                throw new Error(
                  `Element count mismatch between schema and data. Expected ${schema.count} elements, but received ${_payload.length}.`,
                );
              }

              buffer.ensureCapacity(schema.byteLength * schema.count);
              count = schema.count;
            }

            for (let i = 0; i < count; i++) buffer.writeOne(_payload[i]!);

            break;
          }
          case "u8":
          case "u16":
          case "u32":
          case "i8":
          case "i16":
          case "i32":
          case "f32":
          case "f64": {
            const _payload = Array.isArray(payload) ? payload : [payload];

            let count: number;
            if (schema.count === -1) {
              buffer.ensureCapacity(4 + schema.byteLength * _payload.length);
              buffer.view.setUint32(buffer.offset, _payload.length, true);
              buffer.offset += 4;
              count = _payload.length;
            } else {
              if (_payload.length !== schema.count) {
                throw new Error(
                  `Element count mismatch between schema and data. Expected ${schema.count} elements, but received ${_payload.length}.`,
                );
              }

              buffer.ensureCapacity(schema.byteLength * schema.count);
              count = schema.count;
            }
            const method = dvMethodMap[schema.base];

            for (let i = 0; i < count; i++) {
              method.call(buffer.view, buffer.offset, _payload[i], true);
              buffer.offset += schema.byteLength;
            }
            break;
          }
          case "u64":
          case "i64": {
            const _payload = schema.isArray
              ? (payload as any[]).map((p) => getBigInt(p, 2))
              : [getBigInt(payload, 2)];

            let count: number;
            if (schema.count === -1) {
              buffer.ensureCapacity(4 + schema.byteLength * _payload.length);
              buffer.view.setUint32(buffer.offset, _payload.length, true);
              buffer.offset += 4;
              count = _payload.length;
            } else {
              if (_payload.length !== schema.count) {
                throw new Error(
                  `Element count mismatch between schema and data. Expected ${schema.count} elements, but received ${_payload.length}.`,
                );
              }

              buffer.ensureCapacity(schema.byteLength * schema.count);
              count = schema.count;
            }

            for (let i = 0; i < count; i++) {
              buffer.view.setBigUint64(buffer.offset, getBigInt(_payload[i]!, 2), true);
              buffer.offset += 8;
            }
            break;
          }
          case "u128":
          case "i128": {
            const _payload = schema.isArray
              ? (payload as any[]).map((p) => getBigInt(p, 4))
              : [getBigInt(payload, 4)];

            let count: number;
            if (schema.count === -1) {
              buffer.ensureCapacity(4 + schema.byteLength * _payload.length);
              buffer.view.setUint32(buffer.offset, _payload.length, true);
              buffer.offset += 4;
              count = _payload.length;
            } else {
              if (_payload.length !== schema.count) {
                throw new Error(
                  `Element count mismatch between schema and data. Expected ${schema.count} elements, but received ${_payload.length}.`,
                );
              }

              buffer.ensureCapacity(schema.byteLength * schema.count);
              count = schema.count;
            }

            for (let i = 0; i < count; i++) {
              const bi = getBigInt(_payload[i]!, 4);
              buffer.view.setBigInt64(buffer.offset, bi & (2n ** 64n - 1n), true);
              buffer.view.setBigInt64(buffer.offset + 8, (bi >> 64n) & (2n ** 64n - 1n), true);
              buffer.offset += 16;
            }
            break;
          }
          default: {
            throw new Error(`Unsupported base type: ${schema.base}`);
          }
        }

        break;
      }
      case SchemaType.Object: {
        if (typeof payload !== "object") throw new TypeError("data must be an object.");
        stack.push(
          ...schema.entries
            .map<StackEntry>(([key, schema]) => [schema, payload[key], {}])
            .reverse(),
        );
        break;
      }
      case SchemaType.Tuple: {
        if (!Array.isArray(payload)) throw new TypeError("data must be an array.");
        stack.push(
          ...schema.entries.map<StackEntry>((schema, i) => [schema, payload[i], {}]).reverse(),
        );
        break;
      }
      case SchemaType.Array: {
        if (!Array.isArray(payload)) throw new TypeError("data must be an array.");
        if (schema.count !== -1 && schema.count !== payload.length) {
          throw new Error("Element count mismatch between schema and data.");
        }
        if (schema.count === -1) {
          if (payload.length > 2 ** 32 - 1) throw new RangeError("Too many elements in input.");
          buffer.ensureCapacity(4);
          buffer.view.setUint32(buffer.offset, payload.length, true);
          buffer.offset += 4;
        }
        stack.push(...payload.map<StackEntry>((payload) => [schema.schema, payload, {}]).reverse());
        break;
      }
      case SchemaType.Bitpack: {
        if (!Array.isArray(payload)) throw new TypeError("data must be an array.");
        if (payload.length !== schema.bitCount) throw new Error("Element count mismatch.");

        let processed = 0;
        while (processed < schema.bitCount) {
          let byte = 0;
          for (let i = 0; i < 8; i++) byte |= +!!payload[processed + i] << (7 - i);
          buffer.writeOne(byte);
          processed += 8;
        }
        break;
      }
      case SchemaType.Optional: {
        const isSupplied = payload != null;

        buffer.ensureCapacity(1);
        buffer.buffer[buffer.offset++] = +isSupplied;
        isSupplied && stack.push([schema.schema, payload, {}]);
        break;
      }
      case SchemaType.Custom: {
        if ("encodeInto" in schema.handler && schema.handler.encodeInto != null) {
          schema.handler.encodeInto(buffer, payload);
        } else buffer.write(schema.handler.encode(payload));
        break;
      }
      default: {
        throw new TypeError("Unknown schema type.");
      }
    }
  }

  return buffer.finalise();
};
