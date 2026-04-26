import axios from 'axios'

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
})

export default httpClient
