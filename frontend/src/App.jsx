import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Navigate, useOutletContext } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  return (
    <div>
      <Outlet context={{ isAuthenticated, setIsAuthenticated }} />
    </div>
  );
};

// PrivateRoute wrapper component
export const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default App;
