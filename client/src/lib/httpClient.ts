import { supabase } from './supabase'

// HTTP client with automatic JWT token injection
class HttpClient {
  private baseURL: string

  constructor(baseURL: string = '') {
    this.baseURL = baseURL
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    return headers
  }

  async get<T>(url: string): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async delete<T>(url: string): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'DELETE',
      headers,
    })

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`)
    }

    return response.json()
  }
}

// Export a configured instance
export const httpClient = new HttpClient()
