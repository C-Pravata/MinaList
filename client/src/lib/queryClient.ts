import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getDeviceId } from './deviceId';

// Determine the base URL for API requests
// In development, we use relative paths so the Vite proxy can handle them.
// In production, we use the VITE_API_BASE_URL environment variable.
const API_BASE_URL = import.meta.env.PROD && import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL
  : '';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  relativePath: string,
  body?: any,
  options?: { headers?: Record<string, string> },
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    'X-Device-ID': getDeviceId(),
    ...(options?.headers || {}),
  };

  // Prepend the base URL only if it's set (i.e., in production)
  // Ensure relativePath starts with a / if API_BASE_URL is present and relativePath doesn't have one.
  // However, typically relativePath will be like '/api/notes', so simple concatenation is fine.
  const fullPath = API_BASE_URL ? `${API_BASE_URL}${relativePath}` : relativePath;

  const res = await fetch(fullPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // queryKey[0] is expected to be the relative path, e.g., '/api/notes'
    const relativePath = queryKey[0] as string;
    const fullPath = API_BASE_URL ? `${API_BASE_URL}${relativePath}` : relativePath;

    const res = await fetch(fullPath, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
