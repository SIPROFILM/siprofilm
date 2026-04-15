import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Lato font (bundled locally, no external CDN)
import '@fontsource/lato/300.css'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
