import { Notification, Response } from "../../proto/tokyo2006/tps43/tps43";
import { Tps43RelayCorrelator, TPS43_SOURCE_ALL } from "../tps43Relay";

function peripheralResponsePayload(
  requestId: number,
  source: number,
  response: Parameters<typeof Response.create>[0],
): Uint8Array {
  return Notification.encode(
    Notification.create({
      peripheralResponse: {
        requestId,
        source,
        response: Response.create(response),
      },
    }),
  ).finish();
}

function getInfoPayload(
  requestId: number,
  source: number,
  trackpadSources: number[],
): Uint8Array {
  return peripheralResponsePayload(requestId, source, {
    getInfo: {
      trackpads: trackpadSources.map((trackpadSource) => ({
        source: trackpadSource,
      })),
    },
  });
}

describe("Tps43RelayCorrelator", () => {
  it("resolves a deferred response by request id", async () => {
    const correlator = new Tps43RelayCorrelator(100);
    const responsePromise = correlator.waitFor(7);

    expect(
      correlator.handleNotificationPayload(getInfoPayload(7, 1, [0])),
    ).toBe(true);

    await expect(responsePromise).resolves.toMatchObject({
      getInfo: { trackpads: [{ source: 0 }] },
    });
  });

  it("collects broadcast responses until the window closes", async () => {
    const correlator = new Tps43RelayCorrelator(100);
    correlator.handleNotificationPayload(getInfoPayload(9, 0, [0]));

    const responsesPromise = correlator.collectBroadcast(9, 10);
    correlator.handleNotificationPayload(getInfoPayload(9, 1, [1]));

    await expect(responsesPromise).resolves.toMatchObject([
      { source: 0, response: { getInfo: { trackpads: [{ source: 0 }] } } },
      { source: 1, response: { getInfo: { trackpads: [{ source: 1 }] } } },
    ]);
  });

  it("rejects after the timeout", async () => {
    const correlator = new Tps43RelayCorrelator(10);

    await expect(correlator.waitFor(11)).rejects.toThrow(
      "Timed out waiting for TPS43 peripheral response 11",
    );
  });

  it("buffers a response that arrives before waitFor", async () => {
    const correlator = new Tps43RelayCorrelator(100);
    correlator.handleNotificationPayload(getInfoPayload(8, 0, [0]));

    await expect(correlator.waitFor(8)).resolves.toMatchObject({
      getInfo: { trackpads: [{ source: 0 }] },
    });
  });

  it("resolves a broadcast window when clear is called", async () => {
    const correlator = new Tps43RelayCorrelator(100);
    const responsesPromise = correlator.collectBroadcast(12, 10_000);
    correlator.handleNotificationPayload(getInfoPayload(12, 0, [0]));

    correlator.clear("connection lost");

    await expect(responsesPromise).resolves.toMatchObject([
      { source: 0, response: { getInfo: { trackpads: [{ source: 0 }] } } },
    ]);
  });

  it("rejects pending requests and drops buffered responses on clear", async () => {
    const correlator = new Tps43RelayCorrelator(10);
    correlator.handleNotificationPayload(getInfoPayload(13, 0, [0]));
    const pendingPromise = correlator.waitFor(14);

    correlator.clear("relay disabled");

    await expect(pendingPromise).rejects.toThrow("relay disabled");
    await expect(correlator.waitFor(13)).rejects.toThrow("Timed out");
  });

  it("ignores payloads without a peripheral response", () => {
    const correlator = new Tps43RelayCorrelator(100);

    expect(correlator.handleNotificationPayload(new Uint8Array())).toBe(false);
    expect(
      correlator.handleNotificationPayload(
        Notification.encode(Notification.create({})).finish(),
      ),
    ).toBe(false);
  });

  it("exposes the all-source sentinel", () => {
    expect(TPS43_SOURCE_ALL).toBe(0xffffffff);
  });
});
