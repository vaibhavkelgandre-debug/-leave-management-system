import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext.js";
import * as authService from "../services/authService.js";
import { setUnauthorizedHandler } from "../services/apiClient.js";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
        return () => setUnauthorizedHandler(null);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            try {
                const currentUser = await authService.getMe();
                if (!cancelled) {
                    setUser(currentUser);
                }
            } catch (err) {
                if (cancelled) return;
                setUser(null);
                if (err.response?.status !== 401) {
                    setError("Unable to reach the server");
                }
            } finally {
                if (!cancelled) {
                    setIsInitializing(false);
                }
            }
        }

        bootstrap();
        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (credentials) => {
        const loggedInUser = await authService.login(credentials);
        setUser(loggedInUser);
        return loggedInUser;
    }, []);

    const loginWithGoogle = useCallback(async (idToken) => {
        const loggedInUser = await authService.loginWithGoogle(idToken);
        setUser(loggedInUser);
        return loggedInUser;
    }, []);

    const loginWithGithub = useCallback(async (code) => {
        const loggedInUser = await authService.loginWithGithub(code);
        setUser(loggedInUser);
        return loggedInUser;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await authService.getMe();
            setUser(currentUser);
        } catch {
            setUser(null);
        }
    }, []);

    const hasAnyRole = useCallback(
        (...roles) => {
            const flatRoles = roles.flat();
            return !!user && flatRoles.includes(user.role);
        },
        [user]
    );

    const value = useMemo(
        () => ({
            user,
            isInitializing,
            error,
            isAuthenticated: !!user,
            role: user?.role ?? null,
            hasAnyRole,
            login,
            loginWithGoogle,
            loginWithGithub,
            logout,
            refreshUser,
        }),
        [user, isInitializing, error, hasAnyRole, login, loginWithGoogle, loginWithGithub, logout, refreshUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
