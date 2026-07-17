/**
 * Tests for PhysicalKey — focused on the changed-from-default affordances
 * (the hover reset-to-default button). Other states (modified, selected,
 * highlighted) are exercised indirectly through KeymapPage.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { PhysicalKey } from "../PhysicalKey";

const attrs = { width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 };

function renderKey(overrides = {}) {
  const props = {
    attrs,
    keyPosition: 0,
    isModified: false,
    displayName: "A",
    isSelected: false,
    onClick: jest.fn(),
    onReset: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<PhysicalKey {...props} />) };
}

describe("PhysicalKey — changed from default", () => {
  it("reveals a reset-to-default button on hover and calls onResetToDefault", () => {
    const onResetToDefault = jest.fn();
    renderKey({
      isChangedFromDefault: true,
      defaultDisplayName: "B",
      onResetToDefault,
    });

    // Hidden until hovered.
    expect(screen.queryByTitle("Reset to default")).not.toBeInTheDocument();

    // mouseenter doesn't bubble, so fire it on the key container itself.
    const keyEl = screen.getByText("A").closest("div")!;
    fireEvent.mouseEnter(keyEl);

    const resetBtn = screen.getByTitle("Reset to default");
    fireEvent.click(resetBtn);
    expect(onResetToDefault).toHaveBeenCalledTimes(1);
  });

  it("does not show the reset-to-default button when the key is modified", () => {
    renderKey({
      isModified: true,
      isChangedFromDefault: false,
      onResetToDefault: jest.fn(),
    });

    const keyEl = screen.getByText("A").closest("div")!;
    fireEvent.mouseEnter(keyEl);

    // The modified state shows the reset-to-original button instead.
    expect(screen.queryByTitle("Reset to default")).not.toBeInTheDocument();
    expect(screen.getByTitle("Reset to original")).toBeInTheDocument();
  });
});
