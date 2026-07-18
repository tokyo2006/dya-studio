import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import type { StudioLockState } from "@cormoran/zmk-studio-react-hook";
import { StudioUnlockProvider } from "../StudioUnlockContext";
import { useStudioUnlock } from "../../hooks/useStudioUnlock";
import { StudioUnlockCancelledError } from "../../lib/studioUnlock";

// Controllable lock state for the provider.
let mockLockState: StudioLockState = "locked";
jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  useStudioLockState: () => ({
    locked: mockLockState === "locked",
    lockState: mockLockState,
  }),
}));

const unlockError = () => new MetaError(ErrorConditions.UNLOCK_REQUIRED);

/**
 * Test harness: renders a button that runs `fn` through the unlock gate and
 * records the resolved value / rejection reason.
 */
function Harness({
  fn,
  onResolve,
  onReject,
}: {
  fn: () => Promise<unknown>;
  onResolve: (value: unknown) => void;
  onReject: (reason: unknown) => void;
}) {
  const { runWithUnlock } = useStudioUnlock();
  return (
    <button
      onClick={() => {
        runWithUnlock(fn).then(onResolve, onReject);
      }}
    >
      run
    </button>
  );
}

function setLockState(next: StudioLockState) {
  mockLockState = next;
}

describe("StudioUnlockProvider", () => {
  beforeEach(() => {
    mockLockState = "locked";
  });

  it("resolves immediately when the request succeeds (no modal)", async () => {
    const onResolve = jest.fn();
    const fn = jest.fn().mockResolvedValue("ok");
    render(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await userEvent.click(screen.getByText("run"));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("ok"));
    expect(
      screen.queryByText("Keyboard Unlock Required"),
    ).not.toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("opens the modal on an unlock error and auto-retries after unlock", async () => {
    const onResolve = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(unlockError())
      .mockResolvedValue("done");

    const { rerender } = render(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await userEvent.click(screen.getByText("run"));

    // Modal appears; the promise is still pending.
    await screen.findByText("Keyboard Unlock Required");
    expect(onResolve).not.toHaveBeenCalled();

    // Device reports unlocked -> provider auto-retries the same request.
    act(() => setLockState("unlocked"));
    rerender(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("done"));
    expect(fn).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(
        screen.queryByText("Keyboard Unlock Required"),
      ).not.toBeInTheDocument(),
    );
  });

  it("retries the request when the Retry button is clicked", async () => {
    const onResolve = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(unlockError())
      .mockResolvedValue("retried");

    render(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await userEvent.click(screen.getByText("run"));
    await screen.findByText("Keyboard Unlock Required");

    await userEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("retried"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rejects with StudioUnlockCancelledError when the modal is cancelled", async () => {
    const onReject = jest.fn();
    const fn = jest.fn().mockRejectedValue(unlockError());

    render(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={jest.fn()} onReject={onReject} />
      </StudioUnlockProvider>,
    );

    await userEvent.click(screen.getByText("run"));
    await screen.findByText("Keyboard Unlock Required");

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    await waitFor(() =>
      expect(onReject).toHaveBeenCalledWith(
        expect.any(StudioUnlockCancelledError),
      ),
    );
  });

  it("treats an official response with UNLOCK_REQUIRED meta as an unlock error", async () => {
    const onResolve = jest.fn();
    const lockedResponse = {
      meta: { simpleError: ErrorConditions.UNLOCK_REQUIRED },
    };
    const fn = jest
      .fn()
      .mockResolvedValueOnce(lockedResponse)
      .mockResolvedValue({ ok: true });

    const { rerender } = render(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await userEvent.click(screen.getByText("run"));
    await screen.findByText("Keyboard Unlock Required");

    act(() => setLockState("unlocked"));
    rerender(
      <StudioUnlockProvider>
        <Harness fn={fn} onResolve={onResolve} onReject={jest.fn()} />
      </StudioUnlockProvider>,
    );

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ ok: true }));
  });
});
