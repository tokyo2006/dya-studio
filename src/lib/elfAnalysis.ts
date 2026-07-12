/**
 * Minimal ELF/DWARF parser for resolving ARM Cortex-M PC/LR addresses to
 * function names and source locations — a browser-native addr2line.
 *
 * Supports: ELF32 little-endian, DWARF 2/3/4 .debug_line (uncompressed).
 * Falls back gracefully when sections are missing or compressed.
 */

// ELF section types (STT = symbol type)
const STT_FUNC = 2;
const SHN_UNDEF = 0;

// DWARF line number opcodes
const DW_LNS_copy = 1;
const DW_LNS_advance_pc = 2;
const DW_LNS_advance_line = 3;
const DW_LNS_set_file = 4;
const DW_LNS_set_column = 5;
const DW_LNS_negate_stmt = 6;
const DW_LNS_set_basic_block = 7;
const DW_LNS_const_add_pc = 8;
const DW_LNS_fixed_advance_pc = 9;
const DW_LNS_set_prologue_end = 10;
const DW_LNS_set_epilogue_begin = 11;
const DW_LNS_set_isa = 12;
const DW_LNE_end_sequence = 1;
const DW_LNE_set_address = 2;
const DW_LNE_define_file = 3;

export interface SymbolEntry {
  name: string;
  address: number;
  size: number;
}

export interface LineEntry {
  address: number;
  file: string;
  line: number;
}

export interface ElfInfo {
  fileName: string;
  /** Function symbols sorted by address (Thumb bit cleared). */
  symbols: SymbolEntry[];
  /** DWARF line table sorted by address; empty when .debug_line is absent/compressed. */
  lines: LineEntry[];
}

export interface ResolvedAddress {
  functionName?: string;
  /** Byte offset from function start. */
  offset?: number;
  file?: string;
  line?: number;
}

export class ElfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElfParseError";
  }
}

// ---------------------------------------------------------------------------
// Low-level readers
// ---------------------------------------------------------------------------

function readNullString(data: Uint8Array, offset: number): string {
  let end = offset;
  while (end < data.length && data[end] !== 0) end++;
  return new TextDecoder().decode(data.subarray(offset, end));
}

function readULEB128(
  data: Uint8Array,
  offset: number,
): { value: number; bytesRead: number } {
  let result = 0,
    shift = 0,
    pos = offset;
  while (pos < data.length) {
    const byte = data[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) break;
  }
  return { value: result, bytesRead: pos - offset };
}

function readSLEB128(
  data: Uint8Array,
  offset: number,
): { value: number; bytesRead: number } {
  let result = 0,
    shift = 0,
    pos = offset;
  let byte = 0;
  do {
    byte = data[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (pos < data.length && byte & 0x80);
  if (shift < 32 && byte & 0x40) result |= -(1 << shift);
  return { value: result, bytesRead: pos - offset };
}

// ---------------------------------------------------------------------------
// ELF parser
// ---------------------------------------------------------------------------

interface SectionHeader {
  name: string;
  sh_type: number;
  sh_offset: number;
  sh_size: number;
  sh_link: number;
  sh_entsize: number;
}

function parseSectionHeaders(
  bytes: Uint8Array,
  view: DataView,
): SectionHeader[] {
  const e_shoff = view.getUint32(32, true);
  const e_shentsize = view.getUint16(46, true);
  const e_shnum = view.getUint16(48, true);
  const e_shstrndx = view.getUint16(50, true);

  if (e_shoff === 0 || e_shnum === 0) return [];

  // Read raw section headers first (names resolved after)
  const rawSections: Omit<SectionHeader, "name">[] = [];
  for (let i = 0; i < e_shnum; i++) {
    const base = e_shoff + i * e_shentsize;
    if (base + 40 > bytes.length) break;
    rawSections.push({
      sh_type: view.getUint32(base + 4, true),
      sh_offset: view.getUint32(base + 16, true),
      sh_size: view.getUint32(base + 20, true),
      sh_link: view.getUint32(base + 24, true),
      sh_entsize: view.getUint32(base + 36, true),
      // sh_name offset temporarily stored; resolved below
      _nameIdx: view.getUint32(base + 0, true),
    } as Omit<SectionHeader, "name"> & { _nameIdx: number });
  }

  // Resolve section names via .shstrtab
  let shstrtab: Uint8Array | null = null;
  if (e_shstrndx < rawSections.length) {
    const s = rawSections[e_shstrndx] as Omit<SectionHeader, "name"> & {
      _nameIdx: number;
    };
    shstrtab = bytes.subarray(s.sh_offset, s.sh_offset + s.sh_size);
  }

  return rawSections.map((s) => {
    const raw = s as Omit<SectionHeader, "name"> & { _nameIdx: number };
    const name = shstrtab ? readNullString(shstrtab, raw._nameIdx) : "";
    return { ...raw, name } as SectionHeader;
  });
}

function parseSymbols(
  bytes: Uint8Array,
  sections: SectionHeader[],
): SymbolEntry[] {
  const symtabSection = sections.find((s) => s.name === ".symtab");
  if (!symtabSection || symtabSection.sh_size === 0) return [];

  const strtabSection = sections[symtabSection.sh_link];
  if (!strtabSection) return [];

  const symtab = bytes.subarray(
    symtabSection.sh_offset,
    symtabSection.sh_offset + symtabSection.sh_size,
  );
  const strtab = bytes.subarray(
    strtabSection.sh_offset,
    strtabSection.sh_offset + strtabSection.sh_size,
  );

  const entSize = symtabSection.sh_entsize || 16;
  const symbols: SymbolEntry[] = [];

  for (let i = 0; i < Math.floor(symtab.length / entSize); i++) {
    const base = i * entSize;
    if (base + 16 > symtab.length) break;

    const symView = new DataView(
      symtab.buffer,
      symtab.byteOffset + base,
      entSize,
    );
    const st_name = symView.getUint32(0, true);
    const st_value = symView.getUint32(4, true);
    const st_size = symView.getUint32(8, true);
    const st_info = symView.getUint8(12);
    const st_shndx = symView.getUint16(14, true);

    const stType = st_info & 0x0f;

    if (stType === STT_FUNC && st_shndx !== SHN_UNDEF && st_value !== 0) {
      const name = readNullString(strtab, st_name);
      if (name) {
        symbols.push({
          name,
          address: st_value & ~1, // clear Thumb mode bit
          size: st_size,
        });
      }
    }
  }

  symbols.sort((a, b) => a.address - b.address);
  return symbols;
}

// ---------------------------------------------------------------------------
// DWARF .debug_line parser
// ---------------------------------------------------------------------------

function parseDebugLine(data: Uint8Array): LineEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lines: LineEntry[] = [];
  let offset = 0;

  while (offset < data.length) {
    const unitStart = offset;
    if (offset + 4 > data.length) break;

    const unitLength = view.getUint32(offset, true);
    offset += 4;

    if (unitLength === 0xffffffff) break; // 64-bit DWARF not supported

    const unitEnd = unitStart + 4 + unitLength;
    if (unitEnd > data.length) break;

    if (offset + 2 > unitEnd) {
      offset = unitEnd;
      continue;
    }
    const version = view.getUint16(offset, true);
    offset += 2;

    if (version < 2 || version > 4) {
      // DWARF 5 header layout differs significantly — skip
      offset = unitEnd;
      continue;
    }

    if (offset + 4 > unitEnd) {
      offset = unitEnd;
      continue;
    }
    const headerLength = view.getUint32(offset, true);
    offset += 4;

    const programStart = offset + headerLength;
    if (programStart > unitEnd) {
      offset = unitEnd;
      continue;
    }

    if (offset >= unitEnd) {
      offset = unitEnd;
      continue;
    }
    const minInsnLength = data[offset++];

    let maxOpsPerInsn = 1;
    if (version >= 4) {
      if (offset >= unitEnd) {
        offset = unitEnd;
        continue;
      }
      maxOpsPerInsn = data[offset++];
    }

    if (offset >= unitEnd) {
      offset = unitEnd;
      continue;
    }
    const defaultIsStmt = data[offset++] !== 0;

    if (offset >= unitEnd) {
      offset = unitEnd;
      continue;
    }
    const lineBase = new DataView(
      data.buffer,
      data.byteOffset + offset,
      1,
    ).getInt8(0);
    offset++;

    if (offset >= unitEnd) {
      offset = unitEnd;
      continue;
    }
    const lineRange = data[offset++];
    if (lineRange === 0) {
      offset = unitEnd;
      continue;
    }

    if (offset >= unitEnd) {
      offset = unitEnd;
      continue;
    }
    const opcodeBase = data[offset++];

    // Standard opcode lengths (opcodeBase - 1 entries)
    const stdOpLengths: number[] = [];
    for (let i = 1; i < opcodeBase; i++) {
      if (offset >= programStart) break;
      stdOpLengths.push(data[offset++]);
    }

    // Include directories (DWARF 4 format: null-terminated strings)
    const includeDirs: string[] = [""]; // index 0 = compilation dir (ignored)
    while (offset < programStart) {
      if (data[offset] === 0) {
        offset++;
        break;
      }
      const dir = readNullString(data, offset);
      offset += dir.length + 1;
      includeDirs.push(dir);
    }

    // File name entries (DWARF 4 format)
    const fileNames: string[] = [""]; // index 0 unused (DWARF 4 is 1-based)
    while (offset < programStart) {
      if (data[offset] === 0) {
        offset++;
        break;
      }
      const fname = readNullString(data, offset);
      offset += fname.length + 1;

      const dirIdxR = readULEB128(data, offset);
      offset += dirIdxR.bytesRead;
      const timeR = readULEB128(data, offset);
      offset += timeR.bytesRead;
      const lenR = readULEB128(data, offset);
      offset += lenR.bytesRead;

      const dir =
        dirIdxR.value > 0 && dirIdxR.value < includeDirs.length
          ? includeDirs[dirIdxR.value]
          : "";
      fileNames.push(dir ? `${dir}/${fname}` : fname);
    }

    // Execute line number program
    offset = programStart;

    let address = 0;
    let fileIdx = 1;
    let line = 1;
    let isStmt = defaultIsStmt;

    const emitRow = () => {
      const fname =
        fileIdx > 0 && fileIdx < fileNames.length
          ? fileNames[fileIdx]
          : `file${fileIdx}`;
      lines.push({ address, file: fname, line });
    };

    while (offset < unitEnd) {
      const opcode = data[offset++];

      if (opcode === 0) {
        // Extended opcode
        const extLenR = readULEB128(data, offset);
        offset += extLenR.bytesRead;
        if (offset >= unitEnd) break;
        const extOp = data[offset++];
        const extEnd = offset + extLenR.value - 1;

        switch (extOp) {
          case DW_LNE_end_sequence:
            emitRow();
            address = 0;
            fileIdx = 1;
            line = 1;
            isStmt = defaultIsStmt;
            break;
          case DW_LNE_set_address:
            if (offset + 4 <= extEnd) {
              address = view.getUint32(offset, true);
            }
            break;
          case DW_LNE_define_file: {
            const fn = readNullString(data, offset);
            let fnOff = offset + fn.length + 1;
            const dirIdxR = readULEB128(data, fnOff);
            fnOff += dirIdxR.bytesRead;
            const timeR = readULEB128(data, fnOff);
            fnOff += timeR.bytesRead;
            const _lenR = readULEB128(data, fnOff);
            void _lenR;
            const dir =
              dirIdxR.value > 0 && dirIdxR.value < includeDirs.length
                ? includeDirs[dirIdxR.value]
                : "";
            fileNames.push(dir ? `${dir}/${fn}` : fn);
            break;
          }
        }

        offset = extEnd;
        continue;
      }

      if (opcode < opcodeBase) {
        // Standard opcode
        switch (opcode) {
          case DW_LNS_copy:
            emitRow();
            break;
          case DW_LNS_advance_pc: {
            const r = readULEB128(data, offset);
            offset += r.bytesRead;
            address += (r.value * minInsnLength) / Math.max(maxOpsPerInsn, 1);
            break;
          }
          case DW_LNS_advance_line: {
            const r = readSLEB128(data, offset);
            offset += r.bytesRead;
            line += r.value;
            break;
          }
          case DW_LNS_set_file: {
            const r = readULEB128(data, offset);
            offset += r.bytesRead;
            fileIdx = r.value;
            break;
          }
          case DW_LNS_set_column: {
            const r = readULEB128(data, offset);
            offset += r.bytesRead;
            void r; // column not used in output
            break;
          }
          case DW_LNS_negate_stmt:
            isStmt = !isStmt;
            break;
          case DW_LNS_set_basic_block:
            break;
          case DW_LNS_const_add_pc:
            address +=
              Math.floor((255 - opcodeBase) / lineRange) * minInsnLength;
            break;
          case DW_LNS_fixed_advance_pc:
            if (offset + 2 <= unitEnd) {
              address += view.getUint16(offset, true);
              offset += 2;
            }
            break;
          case DW_LNS_set_prologue_end:
            break;
          case DW_LNS_set_epilogue_begin:
            break;
          case DW_LNS_set_isa: {
            const r = readULEB128(data, offset);
            offset += r.bytesRead;
            void r;
            break;
          }
          default:
            // Unknown standard opcode: skip its operands
            if (opcode - 1 < stdOpLengths.length) {
              for (let i = 0; i < stdOpLengths[opcode - 1]; i++) {
                const r = readULEB128(data, offset);
                offset += r.bytesRead;
              }
            }
        }
      } else {
        // Special opcode
        const adj = opcode - opcodeBase;
        address += Math.floor(adj / lineRange) * minInsnLength;
        line += lineBase + (adj % lineRange);
        emitRow();
      }
    }

    offset = unitEnd;
  }

  lines.sort((a, b) => a.address - b.address);
  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseElf(buffer: ArrayBuffer, fileName: string): ElfInfo {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length < 52 ||
    bytes[0] !== 0x7f ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x4c ||
    bytes[3] !== 0x46
  ) {
    throw new ElfParseError("Not an ELF file");
  }

  const elfClass = bytes[4]; // 1 = 32-bit
  const elfData = bytes[5]; // 1 = little-endian

  if (elfClass !== 1) throw new ElfParseError("Only 32-bit ELF is supported");
  if (elfData !== 1)
    throw new ElfParseError("Only little-endian ELF is supported");

  const view = new DataView(buffer);
  const sections = parseSectionHeaders(bytes, view);
  const symbols = parseSymbols(bytes, sections);

  // Parse .debug_line (best-effort; skip if absent or compressed)
  let lines: LineEntry[] = [];
  const debugLineSection = sections.find((s) => s.name === ".debug_line");
  if (debugLineSection && debugLineSection.sh_size > 0) {
    try {
      const data = bytes.subarray(
        debugLineSection.sh_offset,
        debugLineSection.sh_offset + debugLineSection.sh_size,
      );
      lines = parseDebugLine(data);
    } catch {
      // Best-effort: silently ignore DWARF parse errors
    }
  }

  return { fileName, symbols, lines };
}

/** Resolve a raw register value (PC or LR) to function/source info. */
export function resolveAddress(
  elf: ElfInfo,
  rawAddress: number,
): ResolvedAddress | null {
  const address = rawAddress & ~1; // clear ARM Thumb mode bit

  let functionName: string | undefined;
  let offset: number | undefined;

  // Binary search: largest symbol.address <= address
  let lo = 0,
    hi = elf.symbols.length - 1,
    symIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (elf.symbols[mid].address <= address) {
      symIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (symIdx >= 0) {
    const sym = elf.symbols[symIdx];
    if (sym.size === 0 || address < sym.address + sym.size) {
      functionName = sym.name;
      offset = address - sym.address;
    } else {
      // Outside the symbol's size range but closest — still useful
      functionName = sym.name;
      offset = address - sym.address;
    }
  }

  // Binary search: largest line.address <= address
  let file: string | undefined;
  let lineNum: number | undefined;

  let lo2 = 0,
    hi2 = elf.lines.length - 1,
    lineIdx = -1;
  while (lo2 <= hi2) {
    const mid = (lo2 + hi2) >> 1;
    if (elf.lines[mid].address <= address) {
      lineIdx = mid;
      lo2 = mid + 1;
    } else {
      hi2 = mid - 1;
    }
  }

  if (lineIdx >= 0) {
    file = elf.lines[lineIdx].file;
    lineNum = elf.lines[lineIdx].line;
  }

  if (!functionName && !file) return null;
  return { functionName, offset, file, line: lineNum };
}
