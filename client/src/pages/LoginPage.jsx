import { LoginForm } from "../components/auth/LoginForm.jsx";

export function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="mb-1 text-xl font-semibold text-slate-900">Sign in</h1>
                <p className="mb-6 text-sm text-slate-500">Leave Management System</p>
                <LoginForm />
            </div>
        </div>
    );
}
