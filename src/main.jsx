import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 引用 ./src/App.jsx
import './index.css' // 引用 ./src/index.css

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)