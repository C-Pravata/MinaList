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
  // Set up headers
  const headers: Record<string, string> = {};
  
  // Add content-type for operations with data
  if (method !== 'GET' && data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Try to get the auth token from localStorage
  const token = localStorage.getItem('mina_auth_token');
  if (token) {
    console.log(`Adding auth token to ${method} request to ${url}`);
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn(`No auth token found for ${method} request to ${url}`);
  }
  
  // Add custom headers
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }
  
  console.log(`Sending ${method} request to ${url} with auth header: ${headers["Authorization"] ? "Yes" : "No"}`);
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Include cookies for session authentication
  });

  if (!res.ok) {
    console.warn(`Request to ${url} failed with status ${res.status}`);
  } else {
    console.log(`Request to ${url} succeeded with status ${res.status}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, meta }) => {
    // Create empty headers object that TypeScript knows is HeadersInit
    const headers: HeadersInit = {};
    
    // Add any headers from meta if available
    if (meta?.headers) {
      Object.assign(headers, meta.headers);
    }
    
    // Ensure Authorization header is included
    const token = localStorage.getItem('mina_auth_token');
    if (token && !headers['Authorization']) {
      console.log('Adding auth header to query, token found');
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('No token found in localStorage when making API request');
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
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
