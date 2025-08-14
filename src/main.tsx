import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Upmubogo from './pages/Upmubogo/Upmubogo.tsx'
import { BrowserRouter, Route,Routes } from 'react-router-dom'
import Sunggwa from './pages/Sunggwa/Sunggwa.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={"/jira/"}>
      <Routes>
        <Route path="/" element={<Upmubogo />} />
        <Route path="/sunggwa" element={<Sunggwa />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
