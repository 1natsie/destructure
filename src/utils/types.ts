import type { SimpleSchemaBase } from "../schema/schema.ts";

type EnforcePositiveInteger<T extends number> = number extends T
  ? T
  : `${T}` extends `${number}.${number}`
    ? number
    : `${T}` extends `-${string}`
      ? number
      : T;

export type ArrayOf<T, Length extends number = number, Collector extends T[] = []> =
  EnforcePositiveInteger<Length> extends infer L extends number
    ? number extends L
      ? T[]
      : Collector["length"] extends L
        ? Collector
        : ArrayOf<T, L, [...Collector, T]>
    : never;

export type SubstituteArrayValues<
  T extends unknown[],
  Value,
  Collector extends Value[] = [],
> = any[] extends T
  ? Value[]
  : T extends [infer _, ...infer Rest]
    ? SubstituteArrayValues<Rest, Value, [...Collector, Value]>
    : Collector;

export interface DestructuredSimpleSchema {
  base: SimpleSchemaBase;
  isArray: boolean;
  byteLength: number;
  arrayLength: number;
}

export interface GrowingBuffer {
  buffer: Uint8Array<ArrayBuffer>;
  view: DataView<ArrayBuffer>;
  growthFactor: number;
  offset: number;

  updateGrowthFactor(value: number): null;
  ensureCapacity(byteLength: number): null;
  writeOne(value: number): null;
  write(values: ArrayLike<number>): null;
  finalise(): Uint8Array<ArrayBuffer>;
}
