import React, { useState, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import UserManagement from './UserManagement';
import Sidebar from './Sidebar';
import CaseOverview from './CaseOverview';
import Champs from './Champs';
import Settings from './Settings';
import AccessDenied from './AccessDenied';
import OrderCleaner from './OrderCleaner';
import CaseCleaner from './CaseCleaner';
import CombinedIdCleaner from './CombinedIdCleaner';
import QCFailure from './QCFailure';

const API_URL = process.env.REACT_APP_API_URL;

const Dashboard = () => {
  const [activities, setActivities] = useState([]);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const { isAuthenticated } = useOutletContext();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Only fetch activities if user has required role
    const user = JSON.parse(localStorage.getItem('user'));
    const hasPermission = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'moderator';
    
    if (!hasPermission) {
      return;
    }

    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No auth token found');
        }

        const response = await axios.get(`${API_URL}/api/activities`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        setActivities(response.data);
      } catch (error) {
        if (error.response?.status === 403) {
          // User doesn't have permission - silently fail
          return;
        }
        console.error('Error fetching activities');
      }
    };

    if (hasPermission) {
      fetchActivities();
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/logout`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const hasRequiredRole = (requiredRoles) => {
    const userRole = user?.role?.toLowerCase() || 'user';
    if (!requiredRoles) return true;
    return requiredRoles.includes(userRole);
  };

  const renderContent = () => {
    const userRole = user?.role?.toLowerCase() || 'user';
    const hasPermission = userRole === 'admin' || userRole === 'moderator';

    // Check permissions for each section
    if (activeTab === 'activities' && !hasPermission) {
      return <AccessDenied />;
    }
    if (activeTab === 'analytics' && !hasPermission) {
      return <AccessDenied />;
    }
    if (activeTab === 'champs' && !hasPermission) {
      return <AccessDenied />;
    }
    if (activeTab === 'users' && userRole !== 'admin') {
      return <AccessDenied />;
    }
    if (activeTab.startsWith('case-overview-') && 
        ['assigned', 'unassigned', 'other-qs'].includes(activeTab.replace('case-overview-', '')) && 
        !hasPermission) {
      return <AccessDenied />;
    }

    switch (activeTab) {
      case 'activities':
        return hasPermission ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Activities
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Track user actions and system events
              </p>
            </div>
            <div className="border-t border-gray-200">
              {activities.length === 0 ? (
                <div className="px-4 py-5 text-center text-gray-500">
                  No activities found
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {activities.map((activity) => (
                    <li key={activity.id} className="px-4 py-4 hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-medium">
                              {activity.user && activity.user.length > 0 ? activity.user[0].toUpperCase() : '?'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {activity.user || 'Unknown User'}
                            </p>
                            <div className="text-sm text-gray-500">
                              {(() => {
                                const adjustedTimestamp = new Date(activity.timestamp);
                                adjustedTimestamp.setHours(adjustedTimestamp.getHours() + 4);
                                return adjustedTimestamp.toLocaleString('en-US', {
                                  timeZone: 'Asia/Dubai',
                                });
                              })()}
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-gray-900">{activity.action}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : <AccessDenied />;

      case 'users':
        return <UserManagement />;
      case 'case-overview':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Case Overview</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Please select a category from the sidebar to view cases.</p>
              </div>
            </div>
          </div>
        );
      case 'case-overview-assigned':
      case 'case-overview-unassigned':
      case 'case-overview-other-qs':
      case 'case-overview-my-cases':
      case 'case-overview-high-priority':
      case 'case-overview-duplicates':
        return <CaseOverview initialFilter={activeTab.replace('case-overview-', '')} />;
      case 'analytics':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Analytics</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Analytics dashboard coming soon.</p>
              </div>
            </div>
          </div>
        );
      case 'qc-failure':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">QC Failure</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Please select a category from the sidebar to proceed.</p>
              </div>
            </div>
          </div>
        );
      case 'qc-failure-order-cleaner':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <OrderCleaner />
          </div>
        );
      case 'qc-failure-case-cleaner':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <CaseCleaner />
          </div>
        );
      case 'qc-failure-combined-id':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <CombinedIdCleaner />
          </div>
        );
      case 'qc-failure-salesforce-query':
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Salesforce Query</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Salesforce Query functionality coming soon.</p>
              </div>
            </div>
          </div>
        );
      case 'qc-failure-cases':
        // Temporarily hide QC Failure section
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">QC Failure</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>This section is temporarily unavailable.</p>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return <Settings />;
      case 'champs':
        return <Champs />;
      default:
        return (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Welcome to Dashboard</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Select an option from the sidebar to get started.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={user?.role || 'user'} />
        
        <div className="flex flex-col flex-1 overflow-auto">
          <nav className="bg-white shadow">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-end h-16">
                <div className="flex items-center">
                  <Menu as="div" className="ml-3 relative">
                    <div>
                      <Menu.Button className="bg-white rounded-full flex items-center text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <span className="sr-only">Open user menu</span>
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600">
                            {user && user.username ? user.username[0].toUpperCase() : '?'}
                          </span>
                        </div>
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleLogout}
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block px-4 py-2 text-sm text-gray-700 w-full text-left`}
                            >
                              Sign out
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              </div>
            </div>
          </nav>

          <main className="flex-1 overflow-y-auto bg-gray-100">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {renderContent()}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
