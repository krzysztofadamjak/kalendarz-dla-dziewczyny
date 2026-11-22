import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './admin.jsx' // Importujemy nowy komponent
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/dzien/:dayId" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<div className="p-8 text-center text-white bg-slate-900 min-h-screen">Zeskanuj poprawny kod z kalendarza!</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)