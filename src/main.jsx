import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './admin.jsx' 
import Home from './Home.jsx'
import Test from './Test.jsx'
import Regulamin from './Regulamin.jsx' // NOWY IMPORT
import './index.css'
import Wallet from './Wallet.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dzien/:dayId" element={<App />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test/:dayId" element={<App />} />
        <Route path="/regulamin" element={<Regulamin />} /> {/* NOWA TRASA */}
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
		<Route path="/portfel" element={<Wallet />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)