import httpClient from './httpClient'

const TOKEN_KEY = 'sg_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function login(username, password) {
  const { data } = await httpClient.post('/api/auth/login', { username, password })
  setToken(data.access_token)
  return data
}

export async function fetchMe() {
  const { data } = await httpClient.get('/api/auth/me')
  return data
}
