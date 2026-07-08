import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReconnectingOverlay } from "../ReconnectingOverlay";

describe("ReconnectingOverlay", () => {
  test("renders the reconnecting message", () => {
    const onCancel = jest.fn();

    render(<ReconnectingOverlay onCancel={onCancel} />);

    expect(
      screen.getByText("Reconnecting to your keyboard..."),
    ).toBeInTheDocument();
  });

  test("renders a Cancel button that calls onCancel when clicked", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    render(<ReconnectingOverlay onCancel={onCancel} />);

    const cancelButton = screen.getByLabelText("Cancel");
    expect(cancelButton).toBeInTheDocument();

    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("the fixed root has no opaque background fill", () => {
    const onCancel = jest.fn();

    const { container } = render(<ReconnectingOverlay onCancel={onCancel} />);

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toMatch(/fixed inset-0/);
    // The backdrop itself must not carry any background/blur classes - only
    // the inner circle is meant to be visually solid.
    expect(root?.className).not.toMatch(/\bbg-/);
    expect(root?.className).not.toMatch(/backdrop-blur/);
  });
});
