/**
 * Test-only polyfill for `useCustomSubsystem` from
 * `@cormoran/zmk-studio-react-hook`.
 *
 * Several hook tests mock the package's `ZMKCustomSubsystem` class directly
 * (via `jest.mock("@cormoran/zmk-studio-react-hook", ...)`) so they can
 * assert on `service.callRPC` calls. That worked when our hooks constructed
 * `ZMKCustomSubsystem` themselves. Now that the hooks use the library's
 * `useCustomSubsystem`, the constructor call happens inside the library,
 * which imports `ZMKCustomSubsystem` from a private relative path rather
 * than the package's public entry point — so mocking the public
 * `ZMKCustomSubsystem` export alone no longer reaches the RPC call made by
 * `useCustomSubsystem`.
 *
 * This polyfill mirrors the library's real `useCustomSubsystem`
 * implementation (context -> findSubsystem -> `new ZMKCustomSubsystem(...)`)
 * but against an injected (mocked) constructor, so existing `mockCallRPC`
 * assertions keep working unchanged.
 */
import { useCallback, useContext, useMemo, type Context } from "react";
import type { UseZMKAppReturn } from "@cormoran/zmk-studio-react-hook";

interface SubsystemServiceLike {
  callRPC: (
    payload: Uint8Array,
    options?: { timeout?: number },
  ) => Promise<Uint8Array | null>;
}

interface Codec<TReq, TRes> {
  encode: (request: TReq) => Uint8Array;
  decode: (payload: Uint8Array) => TRes;
}

export function createUseCustomSubsystemMock(
  zmkAppContext: Context<UseZMKAppReturn | null>,
  ZMKCustomSubsystemCtor: new (
    connection: unknown,
    subsystemIndex: number,
  ) => SubsystemServiceLike,
) {
  return function useCustomSubsystemMock<TReq, TRes>(
    identifier: string,
    codec?: Codec<TReq, TRes>,
  ) {
    const zmkApp = useContext(zmkAppContext);
    const connection = zmkApp?.state.connection ?? null;
    const subsystem = zmkApp?.findSubsystem(identifier) ?? null;
    const subsystemIndex = subsystem?.index ?? null;

    const service = useMemo(
      () =>
        connection !== null && subsystemIndex !== null
          ? new ZMKCustomSubsystemCtor(connection, subsystemIndex)
          : null,
      [connection, subsystemIndex],
    );
    const ready = service !== null;

    const callRPC = useCallback(
      async (payload: Uint8Array, options?: { timeout?: number }) => {
        if (!service) {
          throw new Error(
            `Custom subsystem "${identifier}" is not ready: ` +
              (connection === null
                ? "no active ZMK connection (is this rendered inside a ZMKAppContext provider with a connected device?)"
                : "subsystem not found on the connected device"),
          );
        }
        return service.callRPC(payload, options);
      },
      [service, identifier, connection],
    );

    const call = useCallback(
      async (request: TReq, options?: { timeout?: number }) => {
        if (!codec) {
          throw new Error(
            `useCustomSubsystem("${identifier}"): call() requires a codec; use callRPC() for raw payloads`,
          );
        }
        const payload = await callRPC(codec.encode(request), options);
        return payload === null ? null : codec.decode(payload);
      },
      [callRPC, identifier, codec],
    );

    if (codec) {
      return { subsystem, ready, callRPC, call };
    }
    return { subsystem, ready, callRPC };
  };
}
