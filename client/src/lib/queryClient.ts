import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { httpClient } from './httpClient';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string = 'GET',
  data?: any
): Promise<any> {
  const safeMethod = method.toUpperCase();
  
  switch (safeMethod) {
    case 'GET':
      return httpClient.get(url);
    case 'POST':
      return httpClient.post(url, data);
    case 'PUT':
      return httpClient.put(url, data);
    case 'DELETE':
      return httpClient.delete(url);
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      return await httpClient.get(queryKey[0] as string);
    } catch (error) {
      if (unauthorizedBehavior === "returnNull" && error instanceof Error && error.message.includes('401')) {
        throw error; // Let React Query handle 401 errors
      }
      throw error;
    }
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