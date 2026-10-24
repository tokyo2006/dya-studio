/**
 * Tests for useTps43 hook (tokyo2006__tps43 trackpad subsystem).
 *
 * `FakeFirmware` stands in for a keyboard with a local half and (optionally) a
 * split peripheral that hosts the trackpad. Requests round-trip through the
 * real protobuf codec; relayed answers arrive as custom notifications, like the
 * real central does.
 */
import { renderHook, act } from "@testing-library/react";
import {
  useTps43,
  TPS43_DISCOVERY_WINDOW_MS,
  TPS43_RELAY_TIMEOUT_MS,
} from "../useTps43";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { CustomNotification } from "@zmkfirmware/zmk-studio-ts-client/custom";
import type { ReactNode } from "react";
import {
  Notification,
  Request,
  Response,
} from "../../proto/tokyo2006/tps43/tps43";
import { Tps43Handler } from "../../lib/transport/demo-tps43";
import { MEMORY_WRITE_DEBOUNCE_MS } from "../useDebouncedMemoryWrite";

const mockCallRPC = jest.fn();

jest.mock("@cormoran/zmk-studio-react-hook", () => {
  const actual = jest.requireActual("@cormoran/zmk-studio-react-hook");
  const {
    createUseCustomSubsystemMock,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("../testUtils/mockUseCustomSubsystem");
  const ZMKCustomSubsystem = jest.fn().mockImplementation(() => ({
    callRPC: mockCallRPC,
  }));
  return {
    ...actual,
    ZMKCustomSubsystem,
    useCustomSubsystem: createUseCustomSubsystemMock(
      actual.ZMKAppContext,
      ZMKCustomSubsystem,
    ),
  };
});

const SUBSYSTEM_ID = "tokyo2006__tps43";
const SUBSYSTEM_INDEX = 1;

type NotificationCallback = (n: CustomNotification) => void;

function createWrapper(available = true) {
  const subscribedCallbacks = new Set<NotificationCallback>();
  const zmkAppValue = {
    state: {
      connection: available ? ({ isConnected: true } as never) : null,
      customSubsystems: available
        ? [{ index: SUBSYSTEM_INDEX, identifier: SUBSYSTEM_ID }]
        : [],
    },
    findSubsystem: (id: string) =>
      available && id === SUBSYSTEM_ID
        ? { index: SUBSYSTEM_INDEX, identifier: id }
        : null,
    onNotification: (subscription: {
      type: string;
      subsystemIndex?: number;
      callback: NotificationCallback;
    }) => {
      if (subscription.type === "custom") {
        subscribedCallbacks.add(subscription.callback);
      }
      return () => {
        subscribedCallbacks.delete(subscription.callback);
      };
    },
  };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ZMKAppContext.Provider value={zmkAppValue as never}>
      {children}
    </ZMKAppContext.Provider>
  );
  return {
    Wrapper,
    emit: (payload: Uint8Array) => {
      for (const callback of subscribedCallbacks) {
        callback({ subsystemIndex: SUBSYSTEM_INDEX, payload });
      }
    },
  };
}

function notificationPayload(
  source: number,
  requestId: number,
  response: Response,
) {
  return Notification.encode(
    Notification.create({
      peripheralResponse: { source, requestId, response },
    }),
  ).finish();
}

interface FirmwareOptions {
  /** Sources reported by this device's own GetInfo answer. */
  localSources?: number[];
  /** Split peripherals that host a trackpad and answer the discovery relay. */
  remoteSources?: number[];
  /** Whether GetInfo asks peripherals to answer (relay transport present). */
  relay?: boolean;
}

/**
 * A trackpad firmware half. Source 0 is always "this device"; positive sources
 * are split peripherals whose answers are deferred to a notification.
 */
class FakeFirmware {
  localSources: number[];
  remoteSources: number[];
  relay: boolean;
  /** Set false to leave a remote request unanswered (timeout path). */
  answerRemote = true;
  lastDeferred: { source: number; requestId: number } | null = null;

  private nextRequestId = 40;
  private emitPayload: ((payload: Uint8Array) => void) | null = null;
  private readonly handlers = new Map<number, Tps43Handler>();

  constructor(options: FirmwareOptions = {}) {
    this.localSources = options.localSources ?? [0];
    this.remoteSources = options.remoteSources ?? [];
    this.relay = options.relay ?? true;
  }

  attach(emit: (payload: Uint8Array) => void) {
    this.emitPayload = emit;
  }

  handlerFor(source: number): Tps43Handler {
    let handler = this.handlers.get(source);
    if (!handler) {
      handler = new Tps43Handler();
      this.handlers.set(source, handler);
    }
    return handler;
  }

  process(request: Request): Response {
    if (request.getInfo !== undefined) {
      const relayRequestId = this.relay ? this.nextId() : 0;
      if (this.relay) {
        for (const source of this.remoteSources) {
          // The peripheral answers about its own local trackpad (source 0); the
          // central stamps the answering half's source on the notification.
          this.notify(source, relayRequestId, {
            getInfo: { trackpads: [{ source: 0 }], relayRequestId: 0 },
          });
        }
      }
      return {
        getInfo: {
          trackpads: this.localSources.map((source) => ({ source })),
          relayRequestId,
        },
      };
    }

    const source =
      request.getState?.source ??
      request.setState?.source ??
      request.reset?.source ??
      0;

    if (source === 0) {
      if (!this.localSources.includes(0)) {
        return { error: { message: "local trackpad not found" } };
      }
      return this.handlerFor(0).process(request);
    }

    const requestId = this.nextId();
    this.lastDeferred = { source, requestId };
    if (this.answerRemote) {
      this.notify(source, requestId, this.handlerFor(source).process(request));
    }
    return { deferred: { requestId } };
  }

  private nextId(): number {
    this.nextRequestId++;
    return this.nextRequestId;
  }

  private notify(source: number, requestId: number, response: Response) {
    const payload = notificationPayload(source, requestId, response);
    setTimeout(() => this.emitPayload?.(payload), 0);
  }
}

function sentRequests(): Request[] {
  return mockCallRPC.mock.calls.map(([payload]) => Request.decode(payload));
}

/**
 * Drain the promise chain, including the 0 ms timers the fake firmware uses to
 * deliver relay notifications.
 */
async function flushPromises() {
  await act(async () => {
    for (let round = 0; round < 3; round++) {
      await jest.advanceTimersByTimeAsync(1);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
  });
}

/** Let the mount-time GetInfo broadcast window close and the state load run. */
async function settleDiscovery() {
  await flushPromises();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(TPS43_DISCOVERY_WINDOW_MS);
  });
  await flushPromises();
}

function mountTps43(firmware: FakeFirmware) {
  const wrapper = createWrapper();
  firmware.attach(wrapper.emit);
  mockCallRPC.mockImplementation(async (payload: Uint8Array) =>
    Response.encode(firmware.process(Request.decode(payload))).finish(),
  );
  const rendered = renderHook(() => useTps43(), { wrapper: wrapper.Wrapper });
  return { ...rendered, emit: wrapper.emit, firmware };
}

describe("useTps43", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("is unavailable when the subsystem is not advertised", () => {
    const { Wrapper } = createWrapper(false);
    const { result } = renderHook(() => useTps43(), { wrapper: Wrapper });
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.values).toBeNull();
    expect(result.current.sources).toEqual([]);
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it("loads the device state on mount", async () => {
    const { result } = mountTps43(new FakeFirmware());
    await settleDiscovery();

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.values?.pressAndHoldTime).toBe(250);
    expect(result.current.values?.bottomBeta).toBe(5);
    expect(result.current.values?.oneFingerTap).toBe(false);
    expect(sentRequests()[0].getInfo).toBeDefined();
  });

  it("discovers a local and a peripheral source", async () => {
    const firmware = new FakeFirmware({
      localSources: [0],
      remoteSources: [1],
    });
    const { result } = mountTps43(firmware);
    await settleDiscovery();

    expect(result.current.sources.map((info) => info.source)).toEqual([0, 1]);
    expect(result.current.selectedSource).toBe(0);
    expect(result.current.values?.bottomBeta).toBe(5);
    expect(result.current.isLoading).toBe(false);

    const requests = sentRequests();
    expect(requests[0].getInfo?.source).toBe(0xffffffff);
    const getState = requests.find((req) => req.getState !== undefined);
    expect(getState?.getState?.source).toBe(0);
  });

  it("shows edits immediately and writes them together after the debounce, persisted", async () => {
    const { result } = mountTps43(new FakeFirmware());
    await settleDiscovery();
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ oneFingerTap: true });
      result.current.update({ bottomBeta: 10 });
    });
    expect(result.current.values?.oneFingerTap).toBe(true);
    expect(result.current.values?.bottomBeta).toBe(10);
    expect(result.current.writeState).toBe("queued");
    expect(mockCallRPC).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEMORY_WRITE_DEBOUNCE_MS);
    });
    await flushPromises();

    const [req] = sentRequests();
    expect(req.setState?.persist).toBe(true);
    expect(req.setState?.source).toBe(0);
    expect(req.setState?.state?.oneFingerTap).toBe(true);
    expect(req.setState?.state?.bottomBeta).toBe(10);
    // Untouched fields are not sent.
    expect(req.setState?.state?.scroll).toBeUndefined();
    expect(result.current.writeState).toBe("idle");
    expect(result.current.state?.bottomBeta).toBe(10);
  });

  it("sends SetState with the selected source", async () => {
    // Dongle shape: this device has no local trackpad, the right half does.
    const firmware = new FakeFirmware({
      localSources: [],
      remoteSources: [1],
    });
    const { result } = mountTps43(firmware);
    await settleDiscovery();

    expect(result.current.sources.map((info) => info.source)).toEqual([1]);
    expect(result.current.selectedSource).toBe(1);
    expect(result.current.values?.bottomBeta).toBe(5);
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ bottomBeta: 12 });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEMORY_WRITE_DEBOUNCE_MS);
    });
    await flushPromises();

    const setState = sentRequests().find((req) => req.setState !== undefined);
    expect(setState?.setState?.source).toBe(1);
    expect(setState?.setState?.persist).toBe(true);
    expect(setState?.setState?.state?.bottomBeta).toBe(12);
    expect(result.current.values?.bottomBeta).toBe(12);
    expect(result.current.state?.bottomBeta).toBe(12);
  });

  it("ignores a notification from a different source", async () => {
    const firmware = new FakeFirmware({
      localSources: [0],
      remoteSources: [1],
    });
    const { result, emit } = mountTps43(firmware);
    await settleDiscovery();
    expect(result.current.selectedSource).toBe(0);

    firmware.answerRemote = false;
    act(() => {
      result.current.selectSource(1);
    });
    await flushPromises();
    const deferred = firmware.lastDeferred;
    expect(deferred?.source).toBe(1);
    expect(deferred?.requestId).toBeGreaterThan(0);

    // An answer from another half must not settle this request.
    act(() => {
      emit(
        notificationPayload(2, deferred!.requestId, {
          getState: { state: { bottomBeta: 200 } },
        }),
      );
    });
    await flushPromises();
    expect(result.current.values).toBeNull();
    expect(result.current.state).toBeNull();

    // The addressed half's answer does.
    act(() => {
      emit(
        notificationPayload(1, deferred!.requestId, {
          getState: { state: { bottomBeta: 77 } },
        }),
      );
    });
    await flushPromises();
    expect(result.current.values?.bottomBeta).toBe(77);
  });

  it("shows an error when the target source never answers", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const firmware = new FakeFirmware({
      localSources: [0],
      remoteSources: [1],
    });
    const { result } = mountTps43(firmware);
    await settleDiscovery();

    firmware.answerRemote = false;
    act(() => {
      result.current.selectSource(1);
    });
    await flushPromises();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(TPS43_RELAY_TIMEOUT_MS);
    });
    await flushPromises();

    expect(result.current.error).toMatch(/did not respond/);
    expect(result.current.values).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("shows 'no trackpad' when GetInfo returns zero sources", async () => {
    const firmware = new FakeFirmware({
      localSources: [],
      remoteSources: [],
    });
    const { result } = mountTps43(firmware);
    await settleDiscovery();

    expect(result.current.sources).toEqual([]);
    expect(result.current.hasDiscovered).toBe(true);
    expect(result.current.selectedSource).toBe(0);
    expect(result.current.values).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    // No guessed source 0 read: there is nothing to read.
    expect(sentRequests().some((req) => req.getState !== undefined)).toBe(
      false,
    );
  });

  it("reset restores firmware defaults", async () => {
    const firmware = new FakeFirmware();
    firmware.handlerFor(0).process({
      setState: { state: { bottomBeta: 200 }, persist: true, source: 0 },
    });
    const { result } = mountTps43(firmware);
    await settleDiscovery();
    expect(result.current.values?.bottomBeta).toBe(200);
    mockCallRPC.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.reset();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEMORY_WRITE_DEBOUNCE_MS * 2);
    });

    expect(ok).toBe(true);
    const reqs = sentRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].reset?.factoryDefaults).toBe(true);
    expect(reqs[0].reset?.source).toBe(0);
    expect(result.current.values?.bottomBeta).toBe(5);
  });
});
