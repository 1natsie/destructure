import {
  schema as _schema,
  SchemaType,
  type CompiledSchema,
  type Data,
  type Schema,
  type SchemaOrCompiledSchema,
} from "../schema/schema.ts";

const dvMethodMap = {
  u8: DataView.prototype.getUint8,
  u16: DataView.prototype.getUint16,
  u32: DataView.prototype.getUint32,
  i8: DataView.prototype.getInt8,
  i16: DataView.prototype.getInt16,
  i32: DataView.prototype.getInt32,
  f32: DataView.prototype.getFloat32,
  f64: DataView.prototype.getFloat64,
};

const getDataView = <T extends ArrayBufferLike>(value: T | ArrayBufferView<T>): DataView<T> => {
  if (ArrayBuffer.isView(value)) {
    return new DataView(value.buffer, value.byteOffset, value.byteLength);
  }

  if (
    value instanceof ArrayBuffer ||
    (globalThis.SharedArrayBuffer != null && value instanceof globalThis.SharedArrayBuffer)
  ) {
    return new DataView<T>(value);
  }

  throw new TypeError("Invalid value type.");
};

export const decode = <T extends Schema>(
  schema: SchemaOrCompiledSchema<T>,
  buffer: Uint8Array<ArrayBuffer>,
  offset = 0,
): Data.Output<T> => {
  type ObjectQueueEntry = ["object", Record<string, any>, string];
  type ArrayQueueEntry = ["array", any[]];
  interface DecoderState {
    stack: CompiledSchema[];
    processingQueue: (ObjectQueueEntry | ArrayQueueEntry)[];
    offset: number;
    result: any;
  }

  const view = getDataView(buffer);
  const bytes = { array: buffer, view: view };
  const state: DecoderState = {
    stack: [_schema(schema)],
    processingQueue: [],
    offset: offset,
    result: null,
  };

  const handleQueue = (value: any): typeof value => {
    const processingQueue = state.processingQueue;
    if (!processingQueue.length) return value;

    const entry = processingQueue.pop()!;
    if (entry[0] === "object") entry[1][entry[2]] = value;
    else if (entry[0] === "array") entry[1].push(value);

    return value;
  };

  do {
    const current = state.stack.pop();
    if (!current) continue;

    let _value: any = null;
    switch (current.schemaType) {
      case SchemaType.Null: {
        handleQueue((_value = null));
        break;
      }
      case SchemaType.Simple: {
        switch (current.base) {
          case "char": {
            const byteLength =
              current.byteLength *
              (current.count === -1 ? view.getUint32(state.offset, true) : current.count);
            current.count === -1 && (state.offset += 4);

            const str = String.fromCharCode(
              ...buffer.slice(state.offset, state.offset + byteLength),
            );
            handleQueue((_value = current.isArray ? str.split("") : str[0]));
            state.offset += byteLength;
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
            const method = dvMethodMap[current.base];
            const values = new Array(
              current.count === -1 ? view.getUint32(state.offset, true) : current.count,
            );

            current.count === -1 && (state.offset += 4);
            for (let i = 0; i < values.length; i++) {
              values[i] = method.call(view, state.offset, true);
              state.offset += current.byteLength;
            }

            handleQueue((_value = current.isArray ? values : values[0]));
            break;
          }
          case "u64":
          case "i64": {
            const values = new Array(
              current.count === -1 ? view.getUint32(state.offset, true) : current.count,
            );

            current.count === -1 && (state.offset += 4);
            for (let i = 0; i < values.length; i++) {
              const raw = view.getBigUint64(state.offset, true);
              values[i] = current.base === "u64" ? raw : BigInt.asIntN(64, raw);
              state.offset += current.byteLength;
            }

            handleQueue((_value = current.isArray ? values : values[0]));
            break;
          }
          case "u128":
          case "i128": {
            const values = new Array(
              current.count === -1 ? view.getUint32(state.offset, true) : current.count,
            );

            current.count === -1 && (state.offset += 4);
            for (let i = 0; i < values.length; i++) {
              const raw =
                view.getBigUint64(state.offset, true) |
                (view.getBigUint64(state.offset + 8, true) << 64n);
              values[i] = current.base === "u128" ? raw : BigInt.asIntN(128, raw);
              state.offset += current.byteLength;
            }

            handleQueue((_value = current.isArray ? values : values[0]));
            break;
          }
          default: {
            throw new Error("Invalid base type.");
          }
        }
        break;
      }
      case SchemaType.Object: {
        const value: Record<string, any> = {};

        handleQueue((_value = value));
        state.stack.push(...current.entries.map((entry) => entry[1]).reverse());
        state.processingQueue.push(
          ...current.entries
            .map<ObjectQueueEntry>((entry) => ["object", value, entry[0]])
            .reverse(),
        );
        break;
      }
      case SchemaType.Tuple: {
        const value: any[] = [];
        const procEntry = ["array", handleQueue((_value = value))];
        state.stack.push(...[...current.entries].reverse());
        state.processingQueue.push(...new Array(current.entries.length).fill(procEntry));
        break;
      }
      case SchemaType.Array: {
        const value: any[] = [];
        const procEntry = ["array", handleQueue((_value = value))];
        const count = current.count === -1 ? view.getUint32(state.offset, true) : current.count;
        state.offset += +(current.count === -1) * 4;
        state.stack.push(...new Array(count).fill(current.schema));
        state.processingQueue.push(...new Array(count).fill(procEntry));
        break;
      }
      case SchemaType.Bitpack: {
        const byteLength = Math.ceil(current.bitCount / 8);
        if (state.offset + byteLength > buffer.length) {
          throw new RangeError("Insufficient data. Unexpected end of data.");
        }

        const value: boolean[] = [];
        let byteIndex = 0;
        for (let i = 0; i < current.bitCount; i++) {
          const bitIndex = i % 8;
          value.push(!!(buffer[state.offset + byteIndex]! & (1 << (7 - bitIndex))));
          if (bitIndex === 7) byteIndex++;
        }
        state.offset += byteLength;
        handleQueue((_value = value));
        break;
      }
      case SchemaType.Optional: {
        const hasData = !!buffer[state.offset++];
        !hasData && handleQueue((_value = null));
        hasData && state.stack.push(current.schema);
        break;
      }
      case SchemaType.Custom: {
        const { value, nextOffset } = current.handler.decode(bytes, state.offset);
        state.offset = nextOffset;

        handleQueue((_value = value));
        break;
      }
      default: {
        throw new TypeError("Unknown schema type.");
      }
    }

    state.result === null && (state.result = _value);
  } while (state.stack.length);

  return state.result;
};
