import { Request } from "@zmkfirmware/zmk-studio-ts-client";
import type { CustomSubsystemInfo } from "@zmkfirmware/zmk-studio-ts-client/custom";
import {
  describeCustomNotification,
  describeOfficialRequest,
  protoByteLength,
  resolveCustomSubsystemIdentifier,
} from "../rpcLogging";

describe("describeOfficialRequest", () => {
  it("derives subsystem.method from an official request", () => {
    expect(describeOfficialRequest({ keymap: { getKeymap: {} } })).toBe(
      "keymap.getKeymap",
    );
    expect(
      describeOfficialRequest({ behaviors: { listAllBehaviors: {} } }),
    ).toBe("behaviors.listAllBehaviors");
  });

  it("falls back to the subsystem when the method is absent", () => {
    expect(describeOfficialRequest({ core: {} })).toBe("core");
  });

  it("returns 'unknown' for an unexpected shape", () => {
    expect(describeOfficialRequest(null)).toBe("unknown");
    expect(describeOfficialRequest({})).toBe("unknown");
    expect(describeOfficialRequest("nope")).toBe("unknown");
  });
});

describe("describeCustomNotification", () => {
  const subsystems: CustomSubsystemInfo[] = [
    { index: 3, identifier: "cormoran__watchdog", uiUrl: [] },
    { index: 7, identifier: "cormoran__pmw3610", uiUrl: [] },
  ];

  it("resolves a subsystem index to its identifier by matching index (not array position)", () => {
    expect(describeCustomNotification(7, subsystems)).toBe(
      "custom:cormoran__pmw3610",
    );
  });

  it("falls back to the raw index when the subsystem list is missing or unmatched", () => {
    expect(describeCustomNotification(3, undefined)).toBe("custom:#3");
    expect(describeCustomNotification(99, subsystems)).toBe("custom:#99");
  });
});

describe("resolveCustomSubsystemIdentifier", () => {
  const subsystems: CustomSubsystemInfo[] = [
    { index: 3, identifier: "cormoran__watchdog", uiUrl: [] },
    { index: 7, identifier: "cormoran__pmw3610", uiUrl: [] },
  ];

  it("resolves a subsystem index to its identifier by matching index", () => {
    expect(resolveCustomSubsystemIdentifier(7, subsystems)).toBe(
      "cormoran__pmw3610",
    );
  });

  it("returns undefined when the subsystem list is missing or unmatched", () => {
    expect(resolveCustomSubsystemIdentifier(3, undefined)).toBeUndefined();
    expect(resolveCustomSubsystemIdentifier(99, subsystems)).toBeUndefined();
  });
});

describe("protoByteLength", () => {
  it("returns the encoded byte length of a ts-proto message", () => {
    const message = { keymap: { getKeymap: {} } } as Request;
    const expected = Request.encode(message).finish().byteLength;
    expect(protoByteLength(Request, message)).toBe(expected);
    expect(protoByteLength(Request, message)).toBeGreaterThan(0);
  });

  it("returns undefined when encoding throws", () => {
    const throwingCodec = {
      encode: () => {
        throw new Error("boom");
      },
    };
    expect(protoByteLength(throwingCodec, {})).toBeUndefined();
  });
});
