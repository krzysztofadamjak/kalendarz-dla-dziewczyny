import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './admin.jsx' 
import Home from './Home.jsx'
import Test from './Test.jsx'
import Regulamin from './Regulamin.jsx'
import Wallet from './Wallet.jsx' // IMPORT NOWEJ ZAKŁADKI PORTFELA
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dzien/:dayId" element={<App />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test/:dayId" element={<App />} />
        <Route path="/regulamin" element={<Regulamin />} />
        <Route path="/portfel" element={<Wallet />} /> {/* NOWA TRASA DO PORTFELA */}
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)