import {
  schema as _schema,
  SchemaType,
  type CompiledSchema,
  type Data,
  type Schema,
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

export const decode = <T extends Schema>(
  schema: T,
  buffer: Uint8Array<ArrayBuffer>,
  offset = 0,
): Data.Output<T> => {
  type ObjectQueueEntry = ["object", Record<string, any>, string];
  type ArrayQueueEntry = ["array", any[]];
  interface DecoderState {
    stack: CompiledSchema[];
    stackData: WeakMap<Exclude<CompiledSchema, string>, Record<string, any>>;
    processingQueue: (ObjectQueueEntry | ArrayQueueEntry)[];
    offset: number;
    result: any;
  }

  const bytes = {
    array: buffer,
    view: new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  };
  const view = bytes.view;
  const state: DecoderState = {
    stack: [_schema(schema)],
    stackData: new WeakMap(),
    processingQueue: [],
    offset: offset,
    result: null,
  };
  const handleQueue = (value: any): typeof value => {
    const processingQueue = state.processingQueue;
    if (!processingQueue.length) return value;

    const entry = processingQueue.shift()!;
    if (entry[0] === "object") entry[1][entry[2]] = value;
    else if (entry[0] === "array") entry[1].push(value);

    return value;
  };

  do {
    const current = state.stack.shift();
    if (!current) continue;

    let _value: any = null;
    switch (current.type) {
      case SchemaType.Null: {
        handleQueue((_value = null));
        break;
      }
      case SchemaType.Simple: {
        if (current.base === "char") {
          const codepoint = buffer[state.offset++];
          if (!codepoint) throw new Error("Unexpected element value.");
          handleQueue((_value = String.fromCharCode(codepoint)));
        } else {
          handleQueue((_value = dvMethodMap[current.base].call(view, state.offset, true)));
          state.offset += current.byteLength;
        }
        break;
      }
      case SchemaType.Object: {
        const value: Record<string, any> = {};

        handleQueue((_value = value));
        state.stack.unshift(...current.entries.map((entry) => entry[1]));
        state.processingQueue.unshift(
          ...current.entries.map<ObjectQueueEntry>((entry) => ["object", value, entry[0]]),
        );
        break;
      }
      case SchemaType.Tuple: {
        const value: any[] = [];
        const procEntry = ["array", handleQueue((_value = value))];
        state.stack.unshift(...current.entries);
        state.processingQueue.unshift(...new Array(current.entries.length).fill(procEntry));
        break;
      }
      case SchemaType.Array: {
        const value: any[] = [];
        const procEntry = ["array", handleQueue((_value = value))];
        const count = current.count === -1 ? view.getUint32(state.offset, true) : current.count;
        state.offset += +(current.count === -1) * 4;
        state.stack.unshift(...new Array(count).fill(current.schema));
        state.processingQueue.unshift(...new Array(count).fill(procEntry));
        break;
      }
      case SchemaType.Optional: {
        const hasData = !!buffer[state.offset++];
        !hasData && handleQueue((_value = undefined));
        hasData && state.stack.unshift(current.schema);
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
