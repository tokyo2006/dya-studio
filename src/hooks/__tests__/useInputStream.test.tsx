import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ZMKAppContext,
  ZMKCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import type { CustomNotification } from "@zmkfirmware/zmk-studio-ts-client/custom";
import {
  INPUT_STREAM_IDENTIFIER,
  frequencyForKeyPosition,
  useInputStream,
} from "../useInputStream";
import {
  Notification,
  Response,
} from "../../proto/zmk/input_stream/input_stream";

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

function createWrapper(zmkAppValue: {
  state: {
    connection: unknown;
    customSubsystems: unknown[];
  };
  findSubsystem: (id: string) => { index: number; identifier: string } | null;
  onNotification: (subscription: {
    type: "custom";
    subsystemIndex: number;
    callback: (notification: CustomNotification) => void;
  }) => () => void;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

describe("useInputStream", () => {
  const oscillators: Array<{ frequency: { value: number } }> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    oscillators.length = 0;
    mockCallRPC.mockResolvedValue(
      Response.encode(Response.create({ ok: {} })).finish(),
    );

    class MockAudioContext {
      state = "running";
      currentTime = 1;
      destination = {};

      createOscillator() {
        const oscillator = {
          type: "sine",
          frequency: { value: 0 },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
        oscillators.push(oscillator);
        return oscillator;
      }

      createGain() {
        return {
          connect: jest.fn(),
          gain: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
        };
      }

      resume = jest.fn().mockResolvedValue(undefined);
    }

    (global as typeof globalThis & { AudioContext: unknown }).AudioContext =
      MockAudioContext;
  });

  it("enables stream mode and highlights notified pressed keys", async () => {
    const connection = { isConnected: true };
    let notificationCallback:
      | ((notification: CustomNotification) => void)
      | null = null;
    const wrapper = createWrapper({
      state: {
        connection,
        customSubsystems: [{ index: 3, identifier: INPUT_STREAM_IDENTIFIER }],
      },
      findSubsystem: (id: string) =>
        id === INPUT_STREAM_IDENTIFIER
          ? { index: 3, identifier: INPUT_STREAM_IDENTIFIER }
          : null,
      onNotification: (subscription) => {
        notificationCallback = subscription.callback;
        return jest.fn();
      },
    });

    const { result } = renderHook(() => useInputStream(), { wrapper });

    await act(async () => {
      await result.current.toggleStream();
    });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isEnabled).toBe(true);
    expect(ZMKCustomSubsystem).toHaveBeenCalledWith(connection, 3);

    act(() => {
      notificationCallback?.({
        subsystemIndex: 3,
        payload: Notification.encode(
          Notification.create({
            keyEvent: {
              position: 4,
              pressed: true,
              behaviorId: 10,
              param1: 0x04,
              param2: 0,
            },
          }),
        ).finish(),
      });
    });

    expect(result.current.highlightedKeys.has(4)).toBe(true);
    expect(oscillators[0].frequency.value).toBe(frequencyForKeyPosition(4));
  });

  it("uses different beep frequencies per key position", () => {
    expect(frequencyForKeyPosition(1)).not.toBe(frequencyForKeyPosition(2));
  });
});
