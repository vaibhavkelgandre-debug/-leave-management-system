import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SearchSelect } from "./SearchSelect.jsx";

const OPTIONS = [
    { value: "emp-1", label: "Rahul Singh" },
    { value: "emp-2", label: "Priya Manager" },
    { value: "emp-3", label: "Asha Employee" },
];

// SearchSelect is a controlled component — a thin stateful wrapper mirrors
// how a real caller (e.g. HrReportsPage's filters) actually uses it, since
// rendering it with a fixed `value` prop and no `onChange` handler wouldn't
// exercise the selection round-trip at all.
function ControlledSearchSelect({ onChange, ...props }) {
    const [value, setValue] = useState("");
    return (
        <SearchSelect
            {...props}
            options={OPTIONS}
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

describe("SearchSelect", () => {
    it("shows the placeholder when nothing is selected", () => {
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />);
        expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Everyone");
    });

    it("opens the dropdown with every option on focus", async () => {
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />);
        await userEvent.click(screen.getByRole("combobox"));

        expect(screen.getByRole("button", { name: "Rahul Singh" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Priya Manager" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Asha Employee" })).toBeInTheDocument();
    });

    it("filters the list as the user types, case-insensitively", async () => {
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.type(input, "PRI");

        expect(screen.getByRole("button", { name: "Priya Manager" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Rahul Singh" })).not.toBeInTheDocument();
    });

    it("shows a no-matches message when nothing matches", async () => {
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.type(input, "zzz");

        expect(screen.getByText(/no matches/i)).toBeInTheDocument();
    });

    it("selecting an option calls onChange and displays its label", async () => {
        const onChange = vi.fn();
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" onChange={onChange} />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.click(screen.getByRole("button", { name: "Priya Manager" }));

        expect(onChange).toHaveBeenCalledWith("emp-2");
        expect(input).toHaveValue("Priya Manager");
        expect(screen.queryByRole("button", { name: "Rahul Singh" })).not.toBeInTheDocument();
    });

    it("clicking the placeholder entry clears the selection", async () => {
        const onChange = vi.fn();
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" onChange={onChange} />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.click(screen.getByRole("button", { name: "Priya Manager" }));
        await userEvent.click(input);
        await userEvent.click(screen.getByRole("button", { name: "Everyone" }));

        expect(onChange).toHaveBeenLastCalledWith("");
        expect(input).toHaveValue("");
    });

    it("pressing Escape closes the dropdown and reverts unsaved typing", async () => {
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.type(input, "something not selected");
        await userEvent.keyboard("{Escape}");

        expect(input).toHaveValue("");
        expect(screen.queryByRole("button", { name: "Rahul Singh" })).not.toBeInTheDocument();
    });

    it("pressing Enter selects the first filtered result", async () => {
        const onChange = vi.fn();
        render(<ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" onChange={onChange} />);
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.type(input, "Priya");
        await userEvent.keyboard("{Enter}");

        expect(onChange).toHaveBeenCalledWith("emp-2");
    });

    it("closes and reverts unsaved typing when clicking outside", async () => {
        render(
            <div>
                <ControlledSearchSelect placeholder="Everyone" aria-label="Filter by employee" />
                <button type="button">Outside</button>
            </div>
        );
        const input = screen.getByRole("combobox");

        await userEvent.click(input);
        await userEvent.type(input, "something not selected");
        await userEvent.click(screen.getByRole("button", { name: "Outside" }));

        expect(input).toHaveValue("");
        expect(screen.queryByRole("button", { name: "Rahul Singh" })).not.toBeInTheDocument();
    });
});
