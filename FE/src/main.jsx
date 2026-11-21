import { createRoot } from 'react-dom/client'
import './tokens.css'
import App from './App.jsx'
import './compact.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
}

createRoot(document.getElementById('root')).render(<App />)
