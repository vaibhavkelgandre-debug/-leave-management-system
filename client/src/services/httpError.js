export function toHttpError(error) {
    return {
        status: error.response?.status ?? null,
        message: error.response?.data?.message ?? "Something went wrong",
        errors: error.response?.data?.errors ?? [],
        isNetworkError: !error.response,
    };
}
