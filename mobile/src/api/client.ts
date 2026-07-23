import { nativeConfig } from "../config";

export const apiBaseUrl = nativeConfig.apiBaseUrl;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

export async function eventslotRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `EventSlot request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
