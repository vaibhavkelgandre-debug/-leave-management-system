import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthProvider.jsx";
import { useAuth } from "../hooks/useAuth.js";
import * as authService from "../services/authService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/authService.js");
vi.mock("../services/apiClient.js", () => ({
    setUnauthorizedHandler: vi.fn(),
}));

function Probe() {
    const auth = useAuth();
    return (
        <div>
            <div data-testid="isInitializing">{String(auth.isInitializing)}</div>
            <div data-testid="isAuthenticated">{String(auth.isAuthenticated)}</div>
            <div data-testid="error">{auth.error ?? ""}</div>
            <button onClick={() => auth.login({ email: "a@b.com", password: "x" }).catch(() => {})}>
                Login
            </button>
            <button onClick={() => auth.logout().catch(() => {})}>Logout</button>
        </div>
    );
}

function renderProvider() {
    return render(
        <AuthProvider>
            <Probe />
        </AuthProvider>
    );
}

describe("AuthProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("restores the session when bootstrap getMe() succeeds", async () => {
        authService.getMe.mockResolvedValue({ id: "1", role: ROLES.EMPLOYEE });
        renderProvider();

        await waitFor(() => expect(screen.getByTestId("isInitializing")).toHaveTextContent("false"));
        expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true");
        expect(screen.getByTestId("error")).toHaveTextContent("");
    });

    it("treats a 401 from getMe() as logged-out, not an error", async () => {
        authService.getMe.mockRejectedValue({ response: { status: 401 } });
        renderProvider();

        await waitFor(() => expect(screen.getByTestId("isInitializing")).toHaveTextContent("false"));
        expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
        expect(screen.getByTestId("error")).toHaveTextContent("");
    });

    it("surfaces a distinct error when the server is unreachable", async () => {
        authService.getMe.mockRejectedValue(new Error("Network Error"));
        renderProvider();

        await waitFor(() => expect(screen.getByTestId("isInitializing")).toHaveTextContent("false"));
        expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
        expect(screen.getByTestId("error")).toHaveTextContent("Unable to reach the server");
    });

    it("sets the user on a successful login", async () => {
        authService.getMe.mockRejectedValue({ response: { status: 401 } });
        authService.login.mockResolvedValue({ id: "1", role: ROLES.HR_ADMIN });
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("isInitializing")).toHaveTextContent("false"));

        await userEvent.click(screen.getByText("Login"));

        await waitFor(() => expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true"));
    });

    it("leaves the user logged out when login rejects", async () => {
        authService.getMe.mockRejectedValue({ response: { status: 401 } });
        authService.login.mockRejectedValue(new Error("Invalid email or password"));
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("isInitializing")).toHaveTextContent("false"));

        await userEvent.click(screen.getByText("Login"));

        expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false");
    });

    it("clears the user on logout even if the request fails", async () => {
        authService.getMe.mockResolvedValue({ id: "1", role: ROLES.EMPLOYEE });
        authService.logout.mockRejectedValue(new Error("network down"));
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("true"));

        await userEvent.click(screen.getByText("Logout"));

        await waitFor(() => expect(screen.getByTestId("isAuthenticated")).toHaveTextContent("false"));
    });
});
