/**
 * Tests for CustomSubsystemsPage component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomSubsystemsPage } from "../CustomSubsystemsPage";
import {
  ZMKAppProvider,
  createMockZMKApp,
  createMockSubsystems,
} from "@cormoran/zmk-studio-react-hook/testing";

describe("CustomSubsystemsPage", () => {
  const renderComponent = (zmkAppOverrides = {}) => {
    const mockZMKApp = createMockZMKApp(zmkAppOverrides);
    return render(
      <ZMKAppProvider value={mockZMKApp}>
        <CustomSubsystemsPage />
      </ZMKAppProvider>,
    );
  };

  describe("Page Header", () => {
    it("should render the page header", () => {
      renderComponent();
      expect(screen.getByText("Custom Subsystems")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Available custom firmware subsystems and their web interfaces",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show empty state message when no subsystems are available", () => {
      renderComponent();
      expect(
        screen.getByText(/No custom subsystems available/),
      ).toBeInTheDocument();
    });
  });

  describe("Subsystem Listing", () => {
    it("should render subsystems with identifier and index", () => {
      const subsystems = createMockSubsystems([
        { index: 0, identifier: "zmk__settings", uiUrl: [] },
        { index: 1, identifier: "zmk__battery", uiUrl: [] },
      ]);
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystems,
          isLoading: false,
          error: null,
        },
      });

      expect(screen.getByText("zmk__settings")).toBeInTheDocument();
      expect(screen.getByText("zmk__battery")).toBeInTheDocument();
    });

    it("should show subsystem index", () => {
      const subsystems = createMockSubsystems([
        { index: 3, identifier: "my__subsystem", uiUrl: [] },
      ]);
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystems,
          isLoading: false,
          error: null,
        },
      });

      expect(screen.getByText("Subsystem index: 3")).toBeInTheDocument();
    });

    it("should show 'no web UI' message when uiUrl is empty", () => {
      const subsystems = createMockSubsystems([
        { index: 0, identifier: "zmk__settings", uiUrl: [] },
      ]);
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystems,
          isLoading: false,
          error: null,
        },
      });

      expect(
        screen.getByText("No web UI available for this subsystem."),
      ).toBeInTheDocument();
    });

    it("should render UI URL links when uiUrl is populated", () => {
      const subsystems = createMockSubsystems([
        {
          index: 0,
          identifier: "zmk__custom",
          uiUrl: ["https://example.com/ui"],
        },
      ]);
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystems,
          isLoading: false,
          error: null,
        },
      });

      expect(screen.getByText("https://example.com/ui")).toBeInTheDocument();
    });

    it("should render multiple UI URLs for a subsystem", () => {
      const subsystems = createMockSubsystems([
        {
          index: 0,
          identifier: "zmk__custom",
          uiUrl: ["https://example.com/ui", "https://another.example.com/app"],
        },
      ]);
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystems,
          isLoading: false,
          error: null,
        },
      });

      expect(screen.getByText("https://example.com/ui")).toBeInTheDocument();
      expect(
        screen.getByText("https://another.example.com/app"),
      ).toBeInTheDocument();
    });
  });

  describe("External Link Security Warning", () => {
    const subsystemWithUrl = createMockSubsystems([
      {
        index: 0,
        identifier: "zmk__custom",
        uiUrl: ["https://example.com/ui"],
      },
    ]);

    const renderWithSubsystems = () =>
      renderComponent({
        state: {
          connection: null,
          deviceInfo: null,
          customSubsystems: subsystemWithUrl,
          isLoading: false,
          error: null,
        },
      });

    it("should show security warning dialog when URL is clicked", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("External Link Warning")).toBeInTheDocument();
    });

    it("should display the URL in the warning dialog", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));

      expect(
        screen.getAllByText("https://example.com/ui").length,
      ).toBeGreaterThan(1);
    });

    it("should display security notice text", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));

      expect(
        screen.getByText(/please do not connect to an unreliable author/i),
      ).toBeInTheDocument();
    });

    it("should close the dialog when Cancel is clicked", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should close the dialog when backdrop is clicked", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Click on the backdrop (the dialog element itself)
      fireEvent.click(screen.getByRole("dialog"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should close the dialog when close button is clicked", () => {
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Close dialog"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should open URL in new tab when 'Open Anyway' is clicked", () => {
      const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      renderWithSubsystems();

      fireEvent.click(screen.getByText("https://example.com/ui"));
      fireEvent.click(screen.getByText("Open Anyway"));

      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/ui",
        "_blank",
        "noopener,noreferrer",
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      openSpy.mockRestore();
    });
  });
});
