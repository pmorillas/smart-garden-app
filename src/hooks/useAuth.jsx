import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getToken, setToken, clearToken, fetchMe } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = not auth
  const [token, setTokenState] = useState(getToken)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    setUser(undefined)
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        setTokenState(null)
        setUser(null)
      })
  }, [token])

  const login = useCallback((newToken) => {
    setToken(newToken)
    setTokenState(newToken)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
