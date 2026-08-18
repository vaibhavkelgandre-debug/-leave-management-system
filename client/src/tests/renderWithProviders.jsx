import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext } from "../context/AuthContext.js";

export function makeAuthValue(overrides = {}) {
    const user = overrides.user ?? null;
    const role = user?.role ?? null;

    return {
        user,
        isInitializing: false,
        error: null,
        isAuthenticated: !!user,
        role,
        hasAnyRole: (...roles) => !!user && roles.flat().includes(role),
        login: vi.fn(),
        loginWithGoogle: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
        ...overrides,
    };
}

export function renderWithProviders(ui, { route = "/", initialEntries, authValue } = {}) {
    const entries = initialEntries ?? [route];
    const value = authValue ?? makeAuthValue();

    return render(
        <MemoryRouter initialEntries={entries}>
            <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
        </MemoryRouter>
    );
}
