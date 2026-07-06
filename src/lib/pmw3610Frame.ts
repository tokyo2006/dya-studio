/**
 * Pure helpers for reassembling a captured PMW3610 frame from GetFrameChunk
 * responses (or streamed FrameStreamChunk notifications) and converting raw
 * sensor bytes into displayable pixel data.
 *
 * Kept free of any RPC/React/canvas dependency so it can be unit tested
 * directly. Ported from cormoran/zmk-driver-pmw3610-with-custom-studio-rpc's
 * web/src/frame.ts.
 */

/** One chunk of frame bytes as returned by GetFrameChunkResponse. */
export interface FrameChunk {
  offset: number;
  data: Uint8Array;
}

export interface AssembledFrame {
  /** Raw sensor bytes (bit7 = PG_VALID, bits[6:0] = pixel value). */
  bytes: Uint8Array;
  /** Number of bytes with bit7 (PG_VALID) clear. */
  invalidCount: number;
}

/**
 * Reassemble a full frame's raw byte buffer from a set of (possibly
 * out-of-order, but assumed non-overlapping and gapless when complete)
 * chunks, and count invalid (bit7 clear) bytes.
 *
 * @param chunks Chunks collected via GetFrameChunk.
 * @param totalLength Total frame length in bytes (from CaptureFrameResponse.pixelCount).
 */
export function assembleFrame(
  chunks: FrameChunk[],
  totalLength: number,
): AssembledFrame {
  const bytes = new Uint8Array(totalLength);

  for (const chunk of chunks) {
    for (let i = 0; i < chunk.data.length; i++) {
      const pos = chunk.offset + i;
      if (pos < 0 || pos >= totalLength) {
        continue;
      }
      bytes[pos] = chunk.data[i];
    }
  }

  let invalidCount = 0;
  for (let i = 0; i < totalLength; i++) {
    if (!isValidPixelByte(bytes[i])) {
      invalidCount++;
    }
  }

  return { bytes, invalidCount };
}

/** Compute the list of chunk offsets needed to cover [0, totalLength). */
export function chunkOffsets(totalLength: number, chunkSize: number): number[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be positive");
  }
  const offsets: number[] = [];
  for (let offset = 0; offset < totalLength; offset += chunkSize) {
    offsets.push(offset);
  }
  return offsets;
}

/** bit7 = PG_VALID. */
export function isValidPixelByte(byte: number): boolean {
  return (byte & 0x80) !== 0;
}

/** Convert a raw sensor byte to an 8-bit grayscale value: bits[6:0] << 1. */
export function pixelByteToGray(byte: number): number {
  return (byte & 0x7f) << 1;
}

/**
 * Render a frame's raw bytes into an RGBA buffer (Uint8ClampedArray-
 * compatible layout, 4 bytes per pixel) at 1x scale (no upscaling -- the
 * caller/canvas handles scaling via drawImage or CSS). Invalid pixels are
 * still rendered (as their masked value) since bit7 is just a validity
 * flag, not part of the topology.
 */
export function frameToRgba(bytes: Uint8Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(bytes.length * 4);
  for (let i = 0; i < bytes.length; i++) {
    const gray = pixelByteToGray(bytes[i]);
    rgba[i * 4 + 0] = gray;
    rgba[i * 4 + 1] = gray;
    rgba[i * 4 + 2] = gray;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** Incremental assembler for a frame streamed as a sequence of
 * (offset, data) chunks (e.g. FrameStreamChunk notifications), as opposed
 * to the one-shot `assembleFrame()` above which takes a complete list of
 * chunks at once. Tracks how many distinct bytes have been written so it
 * can report completion without requiring the caller to count chunks or
 * assume a particular arrival order. */
export interface FrameAssembler {
  /** Write one chunk's bytes at `offset`. Returns true once every byte in
   * [0, totalSize) has been written at least once (chunks may arrive
   * out of order or, in principle, be retransmitted -- writing the same
   * range twice is harmless and does not un-complete the frame). */
  addChunk(offset: number, data: Uint8Array): boolean;
  /** Current buffer contents (bytes not yet written are 0). Safe to call
   * before completion for progressive rendering. */
  getBytes(): Uint8Array;
  /** Number of distinct bytes written so far. */
  bytesWritten(): number;
}

/** Create a fresh incremental assembler for a frame of `totalSize` bytes. */
export function createFrameAssembler(totalSize: number): FrameAssembler {
  const bytes = new Uint8Array(totalSize);
  const written = new Uint8Array(totalSize);
  let writtenCount = 0;

  return {
    addChunk(offset: number, data: Uint8Array): boolean {
      for (let i = 0; i < data.length; i++) {
        const pos = offset + i;
        if (pos < 0 || pos >= totalSize) {
          continue;
        }
        bytes[pos] = data[i];
        if (!written[pos]) {
          written[pos] = 1;
          writtenCount++;
        }
      }
      return writtenCount >= totalSize;
    },
    getBytes(): Uint8Array {
      return bytes;
    },
    bytesWritten(): number {
      return writtenCount;
    },
  };
}
