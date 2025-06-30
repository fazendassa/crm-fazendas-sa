import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any
): Promise<any> {
  // Ensure endpoint starts with /
  let cleanEndpoint = endpoint;
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }
  
  // Remove leading /api if present to avoid duplication
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  } else if (cleanEndpoint.startsWith('/api')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  }
  
  // Ensure cleanEndpoint starts with /
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }
  
  const url = `/api${cleanEndpoint}`;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Only add body for POST and PUT requests
  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Only parse JSON if there's content
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return response.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
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