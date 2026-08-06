export function toHttpError(error) {
    return {
        status: error.response?.status ?? null,
        message: error.response?.data?.message ?? "Something went wrong",
        errors: error.response?.data?.errors ?? [],
        isNetworkError: !error.response,
    };
}

// Builds the message to actually show a user. Validation failures come back with
// a deliberately generic top-level message ("Validation failed") and the useful
// per-field detail in `errors`, so prefer the specifics when they're present —
// otherwise the user is told something went wrong but not what to fix.
export function toErrorMessage(error, fallback = "Something went wrong") {
    const { message, errors, isNetworkError } = toHttpError(error);

    if (isNetworkError) {
        return fallback;
    }
    if (errors.length > 0) {
        return errors.map((issue) => issue.message).join(". ");
    }
    return message || fallback;
}
