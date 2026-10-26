import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("should render the LOADOUT workbench brand and local-first indicator", () => {
    render(<App />);

    expect(screen.getByText("LOADOUT")).toBeInTheDocument();
    expect(screen.getByText("Local-First Engine")).toBeInTheDocument();
  });
  it("should render the primary navigation and analysis stepper", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Main Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Analysis Pipeline Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dataset Intake & Profiling" })).toBeInTheDocument();
  });
});
