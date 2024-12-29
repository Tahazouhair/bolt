import React, { useState } from 'react';
import { Outlet, useNavigate, Navigate, useOutletContext } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated && window.location.pathname !== '/login') {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div>
      <Outlet context={{ isAuthenticated, setIsAuthenticated }} />
    </div>
  );
};

// PrivateRoute wrapper component
export const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useOutletContext();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default App;
