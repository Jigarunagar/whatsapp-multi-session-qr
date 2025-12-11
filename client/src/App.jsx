import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './Pages/HomePage'
import { Toaster } from "react-hot-toast";
import axios from 'axios';
const API = import.meta.env.VITE_API + "/api";

// Example:
axios.get(`${API}/get-sessions`);
axios.post(`${API}/create-user`);

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Router>
        <Routes>
          <Route path='/' element={<HomePage />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
