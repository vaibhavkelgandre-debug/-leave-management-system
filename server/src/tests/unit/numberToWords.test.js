// Unit tests for the payslip's "Amount In Words" converter — pure function,
// no database, covering the Indian numbering system's grouping (thousand /
// lakh / crore) rather than the western thousand / million / billion one.
import { describe, it, expect } from "vitest";
import { numberToWordsIndian } from "../../utils/numberToWords.js";

describe("numberToWordsIndian", () => {
    it("renders zero", () => {
        expect(numberToWordsIndian(0)).toBe("Indian Rupee Zero Only");
    });

    it("renders a plain two-digit amount", () => {
        expect(numberToWordsIndian(42)).toBe("Indian Rupee Forty Two Only");
    });

    it("renders hundreds", () => {
        expect(numberToWordsIndian(305)).toBe("Indian Rupee Three Hundred Five Only");
    });

    it("renders thousands using the Indian grouping, not thousand-comma-3", () => {
        expect(numberToWordsIndian(77000)).toBe("Indian Rupee Seventy Seven Thousand Only");
    });

    it("renders lakhs", () => {
        expect(numberToWordsIndian(250000)).toBe("Indian Rupee Two Lakh Fifty Thousand Only");
    });

    it("renders crores", () => {
        expect(numberToWordsIndian(12345678)).toBe(
            "Indian Rupee One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only"
        );
    });

    it("rounds paise to the nearest rupee", () => {
        expect(numberToWordsIndian(45200.49)).toBe("Indian Rupee Forty Five Thousand Two Hundred Only");
        expect(numberToWordsIndian(45200.5)).toBe("Indian Rupee Forty Five Thousand Two Hundred One Only");
    });

    it("accepts a numeric string, the shape every salary_slips figure actually arrives in", () => {
        expect(numberToWordsIndian("45200.00")).toBe("Indian Rupee Forty Five Thousand Two Hundred Only");
    });
});
