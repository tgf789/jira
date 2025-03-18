import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Upmubogo from './pages/Upmubogo/Upmubogo.tsx'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Sunggwa from './pages/Sunggwa/Sunggwa.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/jira/sunggwa" element={<Sunggwa />} />
        <Route path="/jira/" element={<Upmubogo />} />
      </Routes>
    </Router>
  </StrictMode>,
)
