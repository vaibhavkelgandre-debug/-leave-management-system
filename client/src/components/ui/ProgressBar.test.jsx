import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar.jsx";

describe("ProgressBar", () => {
    it("sets the fill width to the given percent", () => {
        const { container } = render(<ProgressBar percent={40} />);
        expect(container.querySelector(".h-full")).toHaveStyle({ width: "40%" });
    });

    it("clamps out-of-range percentages to 0-100", () => {
        const { container } = render(<ProgressBar percent={150} />);
        expect(container.querySelector(".h-full")).toHaveStyle({ width: "100%" });
    });
});
