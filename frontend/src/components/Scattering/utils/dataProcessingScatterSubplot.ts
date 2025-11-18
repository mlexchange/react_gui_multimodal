import { ExtData } from "@msgpack/msgpack";

export function extractBinary(ext: ExtData | Uint8Array): Uint8Array {
  if (ext instanceof Uint8Array) {
    return ext;
  }
  return typeof ext.data === 'function' ? ext.data(0) : ext.data;
}

export function reconstructFloat32Array(buffer: Uint8Array, shape: [number, number]): number[][] {
  let float32Array: Float32Array;

  if (buffer.byteOffset % 4 === 0) {
    // Buffer is aligned, we can use it directly
    float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  } else {
    // Buffer is not aligned, copy to a new aligned buffer
    // buffer.slice() creates a new ArrayBuffer starting at offset 0 (always aligned)
    const alignedBuffer = buffer.slice();
    float32Array = new Float32Array(alignedBuffer.buffer, 0, alignedBuffer.byteLength / 4);
  }

  return Array.from({ length: shape[0] }, (_, i) =>
    Array.from(float32Array.slice(i * shape[1], (i + 1) * shape[1]))
  );
}
