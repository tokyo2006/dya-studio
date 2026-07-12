import { useCallback, useState } from "react";
import { ElfParseError, parseElf, resolveAddress } from "../lib/elfAnalysis";
import type { ElfInfo, ResolvedAddress } from "../lib/elfAnalysis";

export type { ResolvedAddress };

export interface UseElfAnalysisReturn {
  fileName: string | null;
  hasElf: boolean;
  symbolCount: number;
  hasLineInfo: boolean;
  isLoading: boolean;
  error: string | null;
  resolve: (address: number) => ResolvedAddress | null;
  loadFile: (file: File) => Promise<void>;
  clear: () => void;
}

const NULL_RESOLVE = (): ResolvedAddress | null => null;

export function useElfAnalysis(): UseElfAnalysisReturn {
  const [elfInfo, setElfInfo] = useState<ElfInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const info = parseElf(buffer, file.name);
      if (info.symbols.length === 0 && info.lines.length === 0) {
        throw new ElfParseError(
          "No symbols found — try a non-stripped debug ELF (zephyr.elf)",
        );
      }
      setElfInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse ELF file");
      setElfInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setElfInfo(null);
    setError(null);
  }, []);

  const resolve = useCallback(
    (address: number): ResolvedAddress | null => {
      if (!elfInfo) return null;
      return resolveAddress(elfInfo, address);
    },
    [elfInfo],
  );

  return {
    fileName: elfInfo?.fileName ?? null,
    hasElf: elfInfo !== null,
    symbolCount: elfInfo?.symbols.length ?? 0,
    hasLineInfo: (elfInfo?.lines.length ?? 0) > 0,
    isLoading,
    error,
    resolve: elfInfo ? resolve : NULL_RESOLVE,
    loadFile,
    clear,
  };
}
