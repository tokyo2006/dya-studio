// CRC32 + canonicalization primitives shared by the fast-keymap fingerprint
// contract -- see DESIGN.md SS5 / docs/protocol.md in the parent repo. This
// file has no dependency on the bundled standard-behavior table
// (standardBehaviors.ts) so it can be reused standalone.

import type { BehaviorBindingParametersSet } from "../../proto/cormoran/fast_keymap/fast_keymap";

// ---------------------------------------------------------------------
// CRC32 (IEEE 802.3 / zlib, seed 0) -- bit-for-bit port of Zephyr's
// crc32_ieee_update() (dependencies/zephyr/lib/crc/crc32_sw.c): same
// reflected polynomial 0xEDB88320, same ~crc in/out. This is the standard
// byte-at-a-time CRC32 table algorithm, so it produces identical output to
// the firmware's nibble-table implementation for the same seed/bytes.
// ---------------------------------------------------------------------

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crc32Table = table;
  return table;
}

/** crc32_ieee_update(seed, bytes) -- chainable, seed 0 for a fresh hash. */
export function crc32Update(seed: number, bytes: Uint8Array): number {
  const table = getCrc32Table();
  let crc = ~seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return ~crc >>> 0;
}

// -- little-endian byte helpers mirroring src/fingerprint.c's crc_u8/crc_u16le/... --

function crcU8(seed: number, v: number): number {
  return crc32Update(seed, Uint8Array.of(v & 0xff));
}

function crcU32le(seed: number, v: number): number {
  const u = v >>> 0;
  return crc32Update(
    seed,
    Uint8Array.of(
      u & 0xff,
      (u >>> 8) & 0xff,
      (u >>> 16) & 0xff,
      (u >>> 24) & 0xff,
    ),
  );
}

const textEncoder = new TextEncoder();

/** DESIGN.md SS5's `u8 name_len ; name bytes` -- ONLY used inside
 * metadata bytes (unlike def_fp's alias/display_name, which use a u16
 * length prefix -- see crcStrU16len() below, mirroring the firmware's
 * fk_crc_str_u16len()). Names longer than 255 UTF-8 bytes are truncated to
 * match the firmware's u8 length prefix (an unrealistic case for behavior
 * parameter value display names). */
function crcStrU8len(seed: number, s: string): number {
  const bytes = textEncoder.encode(s);
  const len = Math.min(bytes.length, 0xff);
  seed = crcU8(seed, len);
  if (len) {
    seed = crc32Update(seed, bytes.subarray(0, len));
  }
  return seed;
}

/** DESIGN.md SS4's `str16` primitive -- `u16le length` + raw UTF-8 bytes,
 * reproduced bit-for-bit from the firmware's `crc_str_u16le()`. Used for
 * behavior alias/display_name (def_fp's preimage, §4/§5) -- distinct from
 * crcStrU8len() above, which is only used INSIDE the metadata bytes for a
 * parameter value's display name. Names longer than 65535 UTF-8 bytes are
 * truncated to match the firmware's u16 length prefix. */
export function crcStrU16len(seed: number, s: string): number {
  const bytes = textEncoder.encode(s);
  const len = Math.min(bytes.length, 0xffff);
  seed = crc32Update(seed, Uint8Array.of(len & 0xff, (len >>> 8) & 0xff));
  if (len) {
    seed = crc32Update(seed, bytes.subarray(0, len));
  }
  return seed;
}

/**
 * Canonical metadata bytes (DESIGN.md SS5), reproduced bit-for-bit from
 * `crc_metadata()` in src/fingerprint.c:
 *
 * ```
 * u8  num_sets
 * repeat num_sets:
 *   u8 num_param1_values ; u8 num_param2_values
 *   repeat (all param1 values, then all param2 values):
 *     u8  value_type      ; 0=nil 1=constant 2=range 3=hid_usage 4=layer_id
 *     u32 a                ; constant | range.min | hid keyboard_max (0 if unused)
 *     u32 b                ; 0        | range.max | hid consumer_max
 *     u8  name_len ; name bytes
 * ```
 *
 * This is an internal building block for `defFp()` -- it is no longer a
 * fingerprint in its own right (the wire no longer carries a per-behavior
 * `metadata_fp`; see DESIGN.md SS5's `def_fp`).
 */
function crcMetadata(
  seed: number,
  metadata: BehaviorBindingParametersSet[],
): number {
  seed = crcU8(seed, metadata.length & 0xff);

  for (const paramSet of metadata) {
    seed = crcU8(seed, paramSet.param1.length & 0xff);
    seed = crcU8(seed, paramSet.param2.length & 0xff);

    for (const values of [paramSet.param1, paramSet.param2]) {
      for (const val of values) {
        let valueType = 0;
        let a = 0;
        let b = 0;

        if (val.constant !== undefined) {
          valueType = 1;
          a = val.constant;
        } else if (val.range !== undefined) {
          valueType = 2;
          a = val.range.min;
          b = val.range.max;
        } else if (val.hidUsage !== undefined) {
          valueType = 3;
          a = val.hidUsage.keyboardMax;
          b = val.hidUsage.consumerMax;
        } else if (val.layerId !== undefined) {
          valueType = 4;
        } else {
          valueType = 0; // nil (also the default for an empty oneof)
        }

        seed = crcU8(seed, valueType);
        seed = crcU32le(seed, a);
        seed = crcU32le(seed, b);
        seed = crcStrU8len(seed, val.name);
      }
    }
  }

  return seed;
}

/**
 * `def_fp` (DESIGN.md SS4/SS5): the content-addressed identity + validator
 * for a single behavior. Reproduced bit-for-bit from
 * `fk_fp_behavior_def()`/`crc_behavior_def_preimage()` in
 * `src/fingerprint.c`: the canonical metadata bytes, then `str16 alias`,
 * then `str16 display_name` -- both **as-served** (the exact strings a
 * `BehaviorDetails` response carries), chained from seed 0.
 *
 * A `def_fp` match proves the caller's bundled/cached copy (alias +
 * display_name + metadata) is byte-identical to what the device would
 * serve, so the web keys both its standard-behavior bundle
 * (`bundledByDefFp()`) and its per-device cache by this value.
 */
export function defFp(
  alias: string,
  displayName: string,
  metadata: BehaviorBindingParametersSet[],
): number {
  let seed = crcMetadata(0, metadata);
  seed = crcStrU16len(seed, alias);
  seed = crcStrU16len(seed, displayName);
  // The FULL 32-bit value. The device serves def_fp truncated to a
  // per-device width (Snapshot.def_fp_bits, the firmware's fk_def_fp_bits()),
  // so callers mask the value they compare against summary.def_fp with
  // maskDefFp() below -- the mask is applied at comparison time, not baked
  // into this canonical value.
  return seed >>> 0;
}

/** Masks a full def_fp to the device's served width (Snapshot.def_fp_bits,
 * one of 16/24/32; 0 is treated as 16 for backward compatibility), mirroring
 * the firmware's `fk_fp_behavior_def_full() & fk_def_fp_mask()`. */
export function maskDefFp(fullDefFp: number, bits: number): number {
  const w = bits && bits >= 16 ? bits : 16;
  if (w >= 32) return fullDefFp >>> 0;
  return (fullDefFp & ((1 << w) - 1)) >>> 0;
}
