import { SearchX } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";

export function NotFoundPage() {
    return (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <SearchX className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        </Card>
    );
}
