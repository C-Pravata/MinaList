import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const responseText = await res.text();
    let errorMessage = `${res.status}: ${res.statusText}`;
    
    try {
      // Try to parse as JSON to get a structured error message
      const errorData = JSON.parse(responseText);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      // If not valid JSON, use the response text
      if (responseText) {
        errorMessage = responseText;
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>
): Promise<Response> {
  // Always include content-type for POST, PUT operations or if there's data
  const contentTypeHeader = (method !== 'GET' || data) 
    ? { "Content-Type": "application/json" } 
    : {};
    
  const res = await fetch(url, {
    method,
    headers: {
      ...contentTypeHeader,
      ...customHeaders
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Include cookies for session authentication
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, meta }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: meta?.headers || {}
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      } else {
        throw new Error("Authentication required. Please sign in.");
      }
    }

    if (res.status === 403) {
      throw new Error("You don't have permission to access this resource.");
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
