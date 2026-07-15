import { Request } from "@zmkfirmware/zmk-studio-ts-client";
import { describeOfficialRequest, protoByteLength } from "../rpcLogging";

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
