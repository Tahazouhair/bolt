import React, { useState, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from '../api/axios';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setIsAuthenticated } = useOutletContext();

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/login', credentials);
      
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        setIsAuthenticated(true);
        navigate('/dashboard');
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response) {
        if (err.response.status === 401) {
          setError('Invalid username or password');
        } else if (err.response.data?.message) {
          setError(err.response.data.message);
        } else {
          setError(`Server error: ${err.response.status}`);
        }
      } else if (err.request) {
        setError('Unable to connect to server. Please try again later.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [credentials, navigate, setIsAuthenticated]);

  const setupAdmin = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/setup-admin', {
        username: 'admin',
        password: 'admin123'
      });
      
      setError('Admin account created successfully. Please login.');
    } catch (err) {
      console.error('Admin setup error:', err);
      
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.request) {
        setError('Unable to connect to server. Please try again later.');
      } else {
        setError('Failed to setup admin account');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={credentials.username}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={credentials.password}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className={`text-sm text-center ${error.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>
              {error}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={setupAdmin}
              className={`group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Setup Admin Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
