/**
 * Demo TPS43 handler tests.
 *
 * The demo models a split keyboard whose central (source 0) relays to one
 * peripheral half (source 1), mirroring the firmware's Studio relay: local
 * requests answer synchronously, while `GetInfo{ALL}` and every state request
 * addressed to source 1 answer with `DeferredResponse` and later push a
 * `PeripheralResponse` notification.
 */

import {
  get_decoder,
  get_encoder,
} from "@zmkfirmware/zmk-studio-ts-client/framing";
import {
  Request as ZmkRequest,
  Response as ZmkResponse,
} from "@zmkfirmware/zmk-studio-ts-client";
import {
  Notification,
  Request,
  Response,
  type PeripheralResponse,
} from "../../../proto/tokyo2006/tps43/tps43";
import { TPS43_SOURCE_ALL } from "../../tps43Relay";
import {
  TPS43_DEFAULT_STATE,
  TPS43_DEMO_RELAY_DELAY_MS,
  Tps43Handler,
} from "../demo-tps43";
import { connect } from "../demo";

describe("Tps43Handler demo sources", () => {
  let handler: Tps43Handler;
  let received: Uint8Array[];

  beforeEach(() => {
    jest.useFakeTimers();
    handler = new Tps43Handler();
    received = [];
    handler.notify((payload) => received.push(payload));
  });

  afterEach(() => {
    handler.disconnect();
    jest.useRealTimers();
  });

  const peripheralResponses = (): PeripheralResponse[] =>
    received.map((payload) => {
      const notification = Notification.decode(payload);
      expect(notification.peripheralResponse).toBeDefined();
      return notification.peripheralResponse!;
    });

  const answerAll = () => {
    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    return peripheralResponses();
  };

  it("reports the local trackpad synchronously for a local GetInfo", () => {
    const response = handler.process(
      Request.create({ getInfo: { source: 0 } }),
    );

    expect(response.getInfo?.trackpads).toEqual([{ source: 0 }]);
    expect(response.getInfo?.relayRequestId).toBe(0);
    expect(response.deferred).toBeUndefined();
    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    expect(received).toHaveLength(0);
  });

  it("discovers local and peripheral sources", () => {
    const response = handler.process(
      Request.create({ getInfo: { source: TPS43_SOURCE_ALL } }),
    );

    // The local answer is immediate; the peripheral answers asynchronously.
    expect(response.getInfo?.trackpads).toEqual([{ source: 0 }]);
    const relayRequestId = response.getInfo?.relayRequestId ?? 0;
    expect(relayRequestId).toBeGreaterThan(0);
    // The local answer is a normal GetInfo response; only the half's answer is
    // deferred and delivered later.
    expect(response.deferred).toBeUndefined();
    expect(received).toHaveLength(0);

    const [peripheral] = answerAll();
    expect(peripheral.source).toBe(1);
    expect(peripheral.requestId).toBe(relayRequestId);
    expect(peripheral.response?.getInfo?.trackpads).toEqual([{ source: 1 }]);
  });

  it("answers a state request for source 0 directly", () => {
    const response = handler.process(
      Request.create({ getState: { source: 0 } }),
    );

    expect(response.getState?.state).toEqual(TPS43_DEFAULT_STATE);
    expect(response.deferred).toBeUndefined();
    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    expect(received).toHaveLength(0);
  });

  it("defers a state request for source 1 and pushes the answer", () => {
    const response = handler.process(
      Request.create({ getState: { source: 1 } }),
    );

    expect(response.getState).toBeUndefined();
    const requestId = response.deferred?.requestId ?? 0;
    expect(requestId).toBeGreaterThan(0);

    const [peripheral] = answerAll();
    expect(peripheral.source).toBe(1);
    expect(peripheral.requestId).toBe(requestId);
    expect(peripheral.response?.getState?.state).toEqual(TPS43_DEFAULT_STATE);
  });

  it("applies SetState to the selected demo source only", () => {
    const deferred = handler.process(
      Request.create({
        setState: {
          source: 1,
          persist: true,
          state: { oneFingerTap: true, bottomBeta: 12 },
        },
      }),
    );
    expect(deferred.setState).toBeUndefined();
    const requestId = deferred.deferred?.requestId ?? 0;
    expect(requestId).toBeGreaterThan(0);

    const [answer] = answerAll();
    expect(answer.requestId).toBe(requestId);
    expect(answer.response?.setState?.state).toMatchObject({
      oneFingerTap: true,
      bottomBeta: 12,
    });
    expect(answer.response?.setState?.persisted).toBe(true);

    // The local half keeps its own state.
    const local = handler.process(Request.create({ getState: { source: 0 } }));
    expect(local.getState?.state).toEqual(TPS43_DEFAULT_STATE);

    // Reading the peripheral back confirms the write landed there.
    const remote = handler.process(Request.create({ getState: { source: 1 } }));
    expect(remote.deferred?.requestId).toBeGreaterThan(0);
    const remoteAnswers = answerAll();
    expect(remoteAnswers.at(-1)?.response?.getState?.state).toMatchObject({
      oneFingerTap: true,
      bottomBeta: 12,
    });
  });

  it("resets only the addressed source", () => {
    handler.process(
      Request.create({
        setState: { source: 0, state: { naturalScrollX: true } },
      }),
    );

    const deferred = handler.process(
      Request.create({ reset: { source: 1, factoryDefaults: true } }),
    );
    expect(deferred.reset).toBeUndefined();
    expect(deferred.deferred?.requestId).toBeGreaterThan(0);

    const [answer] = answerAll();
    expect(answer.response?.reset?.state).toEqual(TPS43_DEFAULT_STATE);

    const local = handler.process(Request.create({ getState: { source: 0 } }));
    expect(local.getState?.state?.naturalScrollX).toBe(true);
  });

  it("rejects a state broadcast (ALL is GetInfo-only)", () => {
    for (const request of [
      Request.create({ getState: { source: TPS43_SOURCE_ALL } }),
      Request.create({ setState: { source: TPS43_SOURCE_ALL } }),
      Request.create({ reset: { source: TPS43_SOURCE_ALL } }),
    ]) {
      const response = handler.process(request);
      expect(response.error).toBeDefined();
    }
    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    expect(received).toHaveLength(0);
  });

  it("rejects a source the demo keyboard does not have", () => {
    for (const request of [
      Request.create({ getInfo: { source: 7 } }),
      Request.create({ getState: { source: 7 } }),
      Request.create({ setState: { source: 7 } }),
      Request.create({ reset: { source: 7 } }),
    ]) {
      const response = handler.process(request);
      expect(response.error).toBeDefined();
    }
    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    expect(received).toHaveLength(0);
  });

  it("drops scheduled answers on disconnect", () => {
    handler.process(Request.create({ getInfo: { source: TPS43_SOURCE_ALL } }));
    handler.disconnect();

    jest.advanceTimersByTime(TPS43_DEMO_RELAY_DELAY_MS);
    expect(received).toHaveLength(0);
  });
});

describe("Demo transport TPS43 wiring", () => {
  it("delivers the peripheral discovery answer as a custom notification", async () => {
    const transport = await connect();
    const encoder = new TransformStream(get_encoder());
    const encodedReader = encoder.readable.getReader();
    const requestWriter = encoder.writable.getWriter();
    const writer = transport.writable.getWriter();
    const reader = transport.readable
      .pipeThrough(new TransformStream(get_decoder()))
      .getReader();
    let requestId = 0;

    const forward = (async () => {
      while (true) {
        const { value, done } = await encodedReader.read();
        if (done) break;
        for (const byte of value) await writer.write(Uint8Array.of(byte));
      }
    })();

    const send = async (request: Omit<ZmkRequest, "requestId">) => {
      await requestWriter.write(
        Uint8Array.from(
          ZmkRequest.encode(
            ZmkRequest.create({ requestId: ++requestId, ...request }),
          ).finish(),
        ),
      );
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      return ZmkResponse.decode(value!);
    };

    let tps43Index = -1;
    const callTps43 = async (request: Request) => {
      const response = await send({
        custom: {
          call: {
            subsystemIndex: tps43Index,
            payload: Request.encode(request).finish(),
          },
        },
      });
      const payload = response.requestResponse?.custom?.call?.payload;
      expect(payload).toBeDefined();
      return Response.decode(payload!);
    };

    try {
      const subsystems = await send({
        custom: { listCustomSubsystems: {} },
      });
      const index =
        subsystems.requestResponse?.custom?.listCustomSubsystems?.subsystems.find(
          (subsystem) => subsystem.identifier === "tokyo2006__tps43",
        )?.index;
      expect(index).toBeDefined();
      tps43Index = index!;

      const info = await callTps43(
        Request.create({ getInfo: { source: TPS43_SOURCE_ALL } }),
      );
      expect(info.getInfo?.trackpads).toEqual([{ source: 0 }]);
      const relayRequestId = info.getInfo?.relayRequestId ?? 0;
      expect(relayRequestId).toBeGreaterThan(0);

      // The relayed half answers through the custom-notification stream.
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      const notification = ZmkResponse.decode(value!).notification?.custom
        ?.customNotification;
      expect(notification?.subsystemIndex).toBe(tps43Index);

      const peripheral = Notification.decode(
        notification!.payload,
      ).peripheralResponse;
      expect(peripheral?.source).toBe(1);
      expect(peripheral?.requestId).toBe(relayRequestId);
      expect(peripheral?.response?.getInfo?.trackpads).toEqual([{ source: 1 }]);
    } finally {
      await requestWriter.close();
      transport.abortController.abort();
      await writer.close();
      writer.releaseLock();
      reader.releaseLock();
      encodedReader.releaseLock();
      requestWriter.releaseLock();
      await forward;
    }
  });
});
