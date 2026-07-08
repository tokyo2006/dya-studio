import { render, screen } from "@testing-library/react";
import { SplashScreen } from "../SplashScreen";

describe("SplashScreen", () => {
  test("renders the normal connect state with three connect buttons", () => {
    const onConnect = jest.fn();

    render(
      <SplashScreen onConnect={onConnect} isConnecting={false} error={null} />,
    );

    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Connect via Bluetooth")).toBeInTheDocument();
    expect(screen.getByLabelText("Try Demo Mode")).toBeInTheDocument();
  });

  test("disables the connect buttons while isConnecting is true", () => {
    const onConnect = jest.fn();

    render(
      <SplashScreen onConnect={onConnect} isConnecting={true} error={null} />,
    );

    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Connect via USB")).toBeDisabled();
    expect(screen.getByLabelText("Connect via Bluetooth")).toBeDisabled();
    expect(screen.getByLabelText("Try Demo Mode")).toBeDisabled();
  });

  test("shows an error message when provided", () => {
    const onConnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error="Something went wrong"
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
