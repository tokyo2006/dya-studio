import {
  CHUNK_DATA_MAX,
  SINGLE_FRAME_VALUE_MAX,
  writeValueChunked,
} from "../customSettingsChunkedValue";
import {
  Request,
  Response,
  SettingWriteMode,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";

describe("customSettingsChunkedValue", () => {
  describe("constants", () => {
    it("matches the documented single-frame and chunk limits", () => {
      expect(SINGLE_FRAME_VALUE_MAX).toBe(64);
      expect(CHUNK_DATA_MAX).toBe(128);
    });
  });

  describe("writeValueChunked", () => {
    it("sends a single chunk with commit=true for a small value", async () => {
      const calls: Request[] = [];
      const callRPC = jest.fn(async (request: Request): Promise<Response> => {
        calls.push(request);
        return { status: { affectedCount: 1, message: "ok" } };
      });

      const bytes = Uint8Array.from([1, 2, 3]);
      await writeValueChunked(
        callRPC,
        { key: "macro/foo" },
        bytes,
        SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
      );

      expect(calls).toHaveLength(1);
      const chunk = calls[0].writeValueChunk!;
      expect(chunk.setting).toEqual({ key: "macro/foo" });
      expect(chunk.totalSize).toBe(3);
      expect(chunk.offset).toBe(0);
      expect(chunk.data).toEqual(bytes);
      expect(chunk.commit).toBe(true);
      expect(chunk.mode).toBe(SettingWriteMode.SETTING_WRITE_MODE_MEMORY);
    });

    it("splits a value larger than CHUNK_DATA_MAX into multiple chunks at the right boundaries", async () => {
      const totalSize = CHUNK_DATA_MAX + 10;
      const bytes = Uint8Array.from(
        { length: totalSize },
        (_, index) => index % 256,
      );
      const calls: Request[] = [];
      const callRPC = jest.fn(async (request: Request): Promise<Response> => {
        calls.push(request);
        return { status: { affectedCount: 1, message: "ok" } };
      });

      await writeValueChunked(
        callRPC,
        { key: "macro/bar" },
        bytes,
        SettingWriteMode.SETTING_WRITE_MODE_PERSIST,
      );

      expect(calls).toHaveLength(2);

      const first = calls[0].writeValueChunk!;
      expect(first.offset).toBe(0);
      expect(first.data.length).toBe(CHUNK_DATA_MAX);
      expect(first.data).toEqual(bytes.slice(0, CHUNK_DATA_MAX));
      expect(first.commit).toBe(false);
      expect(first.totalSize).toBe(totalSize);
      expect(first.mode).toBe(SettingWriteMode.SETTING_WRITE_MODE_PERSIST);

      const second = calls[1].writeValueChunk!;
      expect(second.offset).toBe(CHUNK_DATA_MAX);
      expect(second.data.length).toBe(10);
      expect(second.data).toEqual(bytes.slice(CHUNK_DATA_MAX));
      expect(second.commit).toBe(true);
    });

    it("chunks a value that is an exact multiple of CHUNK_DATA_MAX", async () => {
      const totalSize = CHUNK_DATA_MAX * 2;
      const bytes = Uint8Array.from(
        { length: totalSize },
        (_, index) => index % 256,
      );
      const calls: Request[] = [];
      const callRPC = jest.fn(async (request: Request): Promise<Response> => {
        calls.push(request);
        return { status: { affectedCount: 1, message: "ok" } };
      });

      await writeValueChunked(
        callRPC,
        { key: "macro/baz" },
        bytes,
        SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
      );

      expect(calls).toHaveLength(2);
      expect(calls[0].writeValueChunk!.commit).toBe(false);
      expect(calls[0].writeValueChunk!.data.length).toBe(CHUNK_DATA_MAX);
      expect(calls[1].writeValueChunk!.commit).toBe(true);
      expect(calls[1].writeValueChunk!.data.length).toBe(CHUNK_DATA_MAX);
      expect(calls[1].writeValueChunk!.offset).toBe(CHUNK_DATA_MAX);
    });

    it("writes a single commit=true chunk for a zero-length value", async () => {
      const calls: Request[] = [];
      const callRPC = jest.fn(async (request: Request): Promise<Response> => {
        calls.push(request);
        return { status: { affectedCount: 1, message: "ok" } };
      });

      await writeValueChunked(
        callRPC,
        { key: "macro/empty" },
        new Uint8Array(),
        SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].writeValueChunk!.totalSize).toBe(0);
      expect(calls[0].writeValueChunk!.offset).toBe(0);
      expect(calls[0].writeValueChunk!.data.length).toBe(0);
      expect(calls[0].writeValueChunk!.commit).toBe(true);
    });

    it("propagates an error from the RPC and stops sending further chunks", async () => {
      const totalSize = CHUNK_DATA_MAX + 5;
      const bytes = new Uint8Array(totalSize);
      const callRPC = jest.fn(
        async (): Promise<Response> => ({
          error: { message: "device rejected chunk" },
        }),
      );

      await expect(
        writeValueChunked(
          callRPC,
          { key: "macro/err" },
          bytes,
          SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        ),
      ).rejects.toThrow("device rejected chunk");

      expect(callRPC).toHaveBeenCalledTimes(1);
    });

    it("falls back to a generic error message when the RPC error has no message", async () => {
      const callRPC = jest.fn(
        async (): Promise<Response> => ({
          error: { message: "" },
        }),
      );

      await expect(
        writeValueChunked(
          callRPC,
          { key: "macro/err2" },
          Uint8Array.from([1]),
          SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        ),
      ).rejects.toThrow("Write chunk failed");
    });
  });
});
