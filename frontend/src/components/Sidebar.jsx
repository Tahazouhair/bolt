import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const Sidebar = ({ activeTab, setActiveTab, userRole }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path) => {
    navigate(path);
    setActiveTab(path.replace('/', ''));
  };

  const navigation = [
    { name: 'Dashboard', icon: HomeIcon, tab: 'dashboard', path: '/dashboard' },
    { name: 'Activities', icon: ClockIcon, tab: 'activities', path: '/activities', requireRole: ['admin', 'moderator'] },
    { name: 'Analytics', icon: ChartBarIcon, tab: 'analytics', path: '/analytics', requireRole: ['admin', 'moderator'] },
    { 
      name: 'Case Overview', 
      icon: ClockIcon, 
      tab: 'case-overview',
      path: '/case-overview',
      subItems: [
        {
          name: 'All Cases',
          tab: 'case-overview-all',
          path: '/case-overview/all',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'Assigned', 
          tab: 'case-overview-assigned',
          path: '/case-overview/assigned',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'Unassigned', 
          tab: 'case-overview-unassigned',
          path: '/case-overview/unassigned',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'Other Qs', 
          tab: 'case-overview-other-qs',
          path: '/case-overview/other-qs',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'My Open Cases', 
          tab: 'case-overview-my-cases',
          path: '/case-overview/my-cases'
        },
        {
          name: 'High Priority',
          tab: 'case-overview-high-priority',
          path: '/case-overview/high-priority'
        },
        {
          name: 'Duplicates',
          tab: 'case-overview-duplicates',
          path: '/case-overview/duplicates'
        }
      ]
    },
    {
      name: 'QC Failure',
      icon: ClockIcon,
      tab: 'qc-failure',
      path: '/qc-failure',
      hidden: true,
      subItems: [
        {
          name: 'Order Number Cleaner',
          tab: 'qc-failure-order-cleaner',
          path: '/qc-failure/order-cleaner'
        },
        {
          name: 'Case Number Cleaner',
          tab: 'qc-failure-case-cleaner',
          path: '/qc-failure/case-cleaner'
        },
        {
          name: 'Salesforce Query',
          tab: 'qc-failure-salesforce-query',
          path: '/qc-failure/salesforce-query'
        },
        {
          name: 'Combined ID',
          tab: 'qc-failure-combined-id',
          path: '/qc-failure/combined-id'
        },
        {
          name: 'QC Failure Cases',
          tab: 'qc-failure-cases',
          path: '/qc-failure/cases'
        }
      ]
    },
    { name: 'Champs', icon: UserGroupIcon, tab: 'champs', path: '/champs', requireRole: ['admin', 'moderator'] },
    { name: 'User Management', icon: UserGroupIcon, tab: 'users', path: '/users', requireAdmin: true },
    { name: 'Settings', icon: Cog6ToothIcon, tab: 'settings', path: '/settings' },
  ];

  const toggleExpand = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-grow flex-col overflow-y-auto bg-gray-900 pt-5">
        <div className="flex flex-shrink-0 items-center px-4">
          <span className="text-xl font-semibold text-white">CX Ounass</span>
        </div>
        <div className="mt-5 flex flex-grow flex-col">
          <nav className="flex-1 space-y-1 px-2 pb-4">
            {navigation.map((item) => {
              if (item.hidden) return null;
              if (item.requireAdmin && userRole !== 'admin') return null;
              if (item.requireRole && !item.requireRole.includes(userRole.toLowerCase())) return null;

              const isExpanded = expandedItems[item.name];
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isActive = location.pathname === item.path || 
                             (hasSubItems && item.subItems.some(sub => location.pathname === sub.path));

              return (
                <div key={item.name}>
                  <button
                    onClick={() => {
                      if (hasSubItems) {
                        toggleExpand(item.name);
                      } else {
                        handleNavigation(item.path);
                      }
                    }}
                    className={`${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    } group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium`}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={`${
                          isActive
                            ? 'text-white'
                            : 'text-gray-400 group-hover:text-white'
                        } mr-3 h-6 w-6 flex-shrink-0`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </div>
                    {hasSubItems && (
                      isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      )
                    )}
                  </button>
                  
                  {/* Subitems */}
                  {hasSubItems && isExpanded && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.subItems
                        .filter(subItem => 
                          !subItem.requireRole || 
                          (subItem.requireRole && subItem.requireRole.includes(userRole.toLowerCase()))
                        )
                        .map((subItem) => (
                          <button
                            key={subItem.tab}
                            onClick={() => handleNavigation(subItem.path)}
                            className={`${
                              location.pathname === subItem.path
                                ? 'bg-gray-800 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            } group flex w-full items-center rounded-md py-2 pl-2 text-sm font-medium`}
                          >
                            {subItem.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
