export const SIMPLE_SCHEMA_BASE_ARRAY = Object.freeze([
    "char",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "f32",
    "f64",
]);
export const SIMPLE_SCHEMA_BASE = new Set(SIMPLE_SCHEMA_BASE_ARRAY);
export const BITLENGTH_REGEX = /(8|16|32|64|128)$/;
export const SIMPLE_SCHEMA_BASE_REGEX = new RegExp(`^((?:${SIMPLE_SCHEMA_BASE_ARRAY.join("|")})+)(\\[([0-9]+)?\\])?$`, "i");
export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();
// Math.log(256) -> 5.545177444479562
const getByteCount = (x) => +!(x % 256) + Math.ceil(Math.log(x) / 5.545177444479562);
export const coder = {
    encodeNumber: (value) => {
        const result = new Uint8Array(getByteCount(value));
        let offset = 0;
        do {
            result[offset++] = value & 0xff;
            value = Math.floor(value / 256);
        } while (value);
        return result;
    },
    decodeNumber: (value) => {
        let result = 0;
        for (let i = 0; i < value.length; result += (value[i] ?? 0) * 256 ** i++)
            ;
        return result;
    },
    encodeString: (value) => textEncoder.encode(value),
    decodeString: (x) => textDecoder.decode(new Uint8Array(x)),
};
export const getStringCharCodes = (value, guardFn) => {
    const charcodes = new Array(value.length).fill(0);
    if (typeof value !== "string")
        throw new TypeError("value must be a string.");
    if (guardFn == null)
        for (let i = 0; i < value.length; i++)
            charcodes[i] = value.charCodeAt(i);
    else
        for (let i = 0; i < value.length; i++)
            charcodes[i] = guardFn(value.charCodeAt(i));
    return charcodes;
};
export const destructureSimpleSchema = (schema) => {
    const match = schema.match(SIMPLE_SCHEMA_BASE_REGEX);
    if (!match)
        throw new Error("Invalid schema.");
    const [_input, base, array, arrayLength] = match;
    const [_, _byteLength] = base?.match(BITLENGTH_REGEX) || [];
    if (_byteLength == null && base !== "char")
        throw new Error("Invalid schema.");
    if (!SIMPLE_SCHEMA_BASE.has(base)) {
        throw new Error(`Unknown simple schema: ${base}`);
    }
    return {
        base: base,
        isArray: array != null,
        byteLength: base === "char" ? 1 : +_byteLength / 8,
        arrayLength: arrayLength == null ? -1 : +arrayLength,
    };
};
export const sortObjectKeys = (a, b) => {
    const _a = String(a);
    const _b = String(b);
    if (_a < _b)
        return -1;
    if (_a > _b)
        return 1;
    return 0;
};
export const sortObjectEntries = (entries) => {
    return entries.sort(([a], [b]) => sortObjectKeys(a, b));
};
export const createGrowingBuffer = (initialSize = 1024 * 4, growth = 2) => {
    let buffer = new Uint8Array(initialSize);
    return {
        buffer: buffer,
        view: new DataView(buffer.buffer),
        growthFactor: growth > 1 ? growth : 2,
        offset: 0,
        updateGrowthFactor(value) {
            if (!Number.isFinite(value))
                throw new Error("Growth factor must be finite.");
            if (value <= 1)
                throw new Error("Growth factor must be greater than 1.");
            this.growthFactor = value;
            return null;
        },
        ensureCapacity(byteLength) {
            if (this.buffer.byteLength >= this.offset + byteLength)
                return null;
            const newBuffer = new Uint8Array(Math.ceil(Math.max(this.buffer.byteLength * this.growthFactor, this.offset + byteLength)));
            newBuffer.set(this.buffer, 0);
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer);
            return null;
        },
        writeOne(value) {
            this.ensureCapacity(1);
            this.buffer[this.offset++] = value;
            return null;
        },
        write(values) {
            this.ensureCapacity(values.length);
            this.buffer.set(values, this.offset);
            this.offset += values.length;
            return null;
        },
        finalise() {
            return this.buffer.slice(0, this.offset);
        },
    };
};
//# sourceMappingURL=utils.js.map