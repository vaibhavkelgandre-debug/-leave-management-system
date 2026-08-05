import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App Component", () => {
    test("renders Users heading data", () => {
        render(<App />);

        expect(
            screen.getByText("Users")
        ).toBeInTheDocument();
    });
});
