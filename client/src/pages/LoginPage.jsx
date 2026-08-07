import { LoginForm } from "../components/auth/LoginForm.jsx";
import { Card } from "../components/ui/Card.jsx";

export function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-sm p-8">
                <h1 className="mb-1 text-xl font-semibold text-slate-900">Sign in</h1>
                <p className="mb-6 text-sm text-slate-500">Leave Management System</p>
                <LoginForm />
            </Card>
        </div>
    );
}
