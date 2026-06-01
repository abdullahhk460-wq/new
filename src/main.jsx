import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import UserProfile from './UserProfile.jsx';
import AdminLogin from './AdminLogin.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Public website */}
        <Route path="/" element={<App />} />

        {/* Member Profile Dashboard */}
        <Route path="/profile" element={<UserProfile />} />

        {/* Hidden admin login — NOT linked from the public site */}
        <Route path="/secure-login" element={<AdminLogin />} />

        {/* Protected admin dashboard — requires authenticated session */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Any unknown URL → send to home */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
