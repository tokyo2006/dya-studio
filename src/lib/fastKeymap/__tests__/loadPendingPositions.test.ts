import { loadPendingPositions } from "../fastKeymap";
import { ErrorCode } from "../../../proto/cormoran/fast_keymap/fast_keymap";
import type {
  Request,
  Response,
} from "../../../proto/cormoran/fast_keymap/fast_keymap";

describe("loadPendingPositions", () => {
  it("returns per-layer unsaved positions from get_pending", async () => {
    const requests: Request[] = [];
    const call = async (request: Request): Promise<Response> => {
      requests.push(request);
      if (request.getPending) {
        return {
          getPending: {
            layers: [
              { id: 0, positions: [1, 5] },
              { id: 2, positions: [3] },
            ],
          },
        } as Response;
      }
      throw new Error(`unexpected request: ${JSON.stringify(request)}`);
    };

    const pending = await loadPendingPositions(call);

    expect(requests).toHaveLength(1);
    expect(requests[0].getPending).toBe(true);
    expect(pending).toEqual([
      { id: 0, positions: [1, 5] },
      { id: 2, positions: [3] },
    ]);
  });

  it("returns an empty array when nothing is pending", async () => {
    const call = async (request: Request): Promise<Response> => {
      if (request.getPending) {
        return { getPending: { layers: [] } } as Response;
      }
      throw new Error(`unexpected request: ${JSON.stringify(request)}`);
    };

    expect(await loadPendingPositions(call)).toEqual([]);
  });

  it("throws a descriptive error when the device returns an error response", async () => {
    const call = async (): Promise<Response> =>
      ({ error: { code: ErrorCode.ERR_GENERIC } }) as Response;

    await expect(loadPendingPositions(call)).rejects.toThrow(
      /fast_keymap RPC error/,
    );
  });
});
