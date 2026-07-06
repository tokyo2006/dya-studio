/**
 * Tests for SectionCard's collapse/expand behavior.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionCard } from "../SectionCard";

describe("SectionCard", () => {
  it("is collapsed by default and does not render children", () => {
    render(
      <SectionCard icon={<span />} title="My Section">
        <p>Secret content</p>
      </SectionCard>,
    );

    expect(screen.getByText("My Section")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /my section/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("expands on header click and shows children", () => {
    render(
      <SectionCard icon={<span />} title="My Section">
        <p>Secret content</p>
      </SectionCard>,
    );

    fireEvent.click(screen.getByRole("button", { name: /my section/i }));

    expect(screen.getByText("Secret content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /my section/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("collapses again on a second header click", () => {
    render(
      <SectionCard icon={<span />} title="My Section">
        <p>Secret content</p>
      </SectionCard>,
    );

    const header = screen.getByRole("button", { name: /my section/i });
    fireEvent.click(header);
    expect(screen.getByText("Secret content")).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("honors defaultOpen=true", () => {
    render(
      <SectionCard icon={<span />} title="My Section" defaultOpen>
        <p>Secret content</p>
      </SectionCard>,
    );

    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });

  it("always renders the summary badge, even while collapsed", () => {
    render(
      <SectionCard icon={<span />} title="My Section" summary={<span>OK</span>}>
        <p>Secret content</p>
      </SectionCard>,
    );

    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("does not toggle the section when an action is clicked", () => {
    const actionClick = jest.fn();
    render(
      <SectionCard
        icon={<span />}
        title="My Section"
        actions={<button onClick={actionClick}>Do thing</button>}
      >
        <p>Secret content</p>
      </SectionCard>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Do thing" }));

    expect(actionClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });
});
