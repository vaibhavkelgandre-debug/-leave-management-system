import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar.jsx";

describe("Avatar", () => {
    it("renders the first-and-last-name initials, uppercased", () => {
        render(<Avatar firstName="asha" lastName="employee" />);
        expect(screen.getByText("AE")).toBeInTheDocument();
    });

    it("doesn't blow up when a name is missing", () => {
        render(<Avatar firstName="Asha" />);
        expect(screen.getByText("A")).toBeInTheDocument();
    });
});
