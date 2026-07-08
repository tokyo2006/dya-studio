import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplashScreen } from "../SplashScreen";

describe("SplashScreen", () => {
  test("renders the normal connect state with three connect buttons", () => {
    const onConnect = jest.fn();
    const onCancelReconnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error={null}
        isReconnecting={false}
        onCancelReconnect={onCancelReconnect}
      />,
    );

    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Connect via Bluetooth")).toBeInTheDocument();
    expect(screen.getByLabelText("Try Demo Mode")).toBeInTheDocument();
    expect(
      screen.queryByText("Reconnecting to your keyboard..."),
    ).not.toBeInTheDocument();
  });

  test("shows the reconnecting message and cancel button, and hides the connect buttons, while reconnecting", () => {
    const onConnect = jest.fn();
    const onCancelReconnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error={null}
        isReconnecting={true}
        onCancelReconnect={onCancelReconnect}
      />,
    );

    expect(
      screen.getByText("Reconnecting to your keyboard..."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel")).toBeInTheDocument();

    expect(screen.queryByLabelText("Connect via USB")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Connect via Bluetooth"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Try Demo Mode")).not.toBeInTheDocument();
  });

  test("calls onCancelReconnect when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onConnect = jest.fn();
    const onCancelReconnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error={null}
        isReconnecting={true}
        onCancelReconnect={onCancelReconnect}
      />,
    );

    await user.click(screen.getByLabelText("Cancel"));

    expect(onCancelReconnect).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });

  test("does not conflate isReconnecting with isConnecting (manual connect) state", () => {
    const onConnect = jest.fn();
    const onCancelReconnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={true}
        error={null}
        isReconnecting={false}
        onCancelReconnect={onCancelReconnect}
      />,
    );

    // Manual "connecting" state still shows the connect buttons (disabled),
    // not the reconnecting message.
    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Connect via USB")).toBeDisabled();
    expect(
      screen.queryByText("Reconnecting to your keyboard..."),
    ).not.toBeInTheDocument();
  });

  test("shows an error message when provided", () => {
    const onConnect = jest.fn();
    const onCancelReconnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error="Something went wrong"
        isReconnecting={false}
        onCancelReconnect={onCancelReconnect}
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
