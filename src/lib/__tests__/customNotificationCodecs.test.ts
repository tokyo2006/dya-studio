import { Notification as WatchdogNotification } from "../../proto/cormoran/watchdog/watchdog";
import { decodeCustomNotification } from "../customNotificationCodecs";

describe("decodeCustomNotification", () => {
  it("decodes a payload with its subsystem's Notification proto", () => {
    const notification = WatchdogNotification.fromPartial({
      peripheralResponse: { sourceKeyboardIndex: 2 },
    });
    const payload = WatchdogNotification.encode(notification).finish();

    expect(decodeCustomNotification("cormoran__watchdog", payload)).toEqual(
      WatchdogNotification.decode(payload),
    );
  });

  it("returns undefined for an unregistered subsystem identifier", () => {
    const payload = new Uint8Array([1, 2, 3]);
    expect(
      decodeCustomNotification("cormoran__unknown", payload),
    ).toBeUndefined();
  });

  it("returns undefined when the identifier or payload is absent", () => {
    expect(
      decodeCustomNotification(undefined, new Uint8Array([1])),
    ).toBeUndefined();
    expect(
      decodeCustomNotification("cormoran__watchdog", undefined),
    ).toBeUndefined();
  });
});
