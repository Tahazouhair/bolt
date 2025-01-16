import React, { useState } from 'react';
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

  const navigation = [
    { name: 'Dashboard', icon: HomeIcon, tab: 'dashboard' },
    { name: 'Activities', icon: ClockIcon, tab: 'activities', requireRole: ['admin', 'moderator'] },
    { name: 'Analytics', icon: ChartBarIcon, tab: 'analytics', requireRole: ['admin', 'moderator'] },
    { 
      name: 'Case Overview', 
      icon: ClockIcon, 
      tab: 'case-overview',
      subItems: [
        { 
          name: 'Assigned', 
          tab: 'case-overview-assigned',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'Unassigned', 
          tab: 'case-overview-unassigned',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'Other Qs', 
          tab: 'case-overview-other-qs',
          requireRole: ['admin', 'moderator']
        },
        { 
          name: 'My Open Cases', 
          tab: 'case-overview-my-cases'
        },
        {
          name: 'High Priority',
          tab: 'case-overview-high-priority'
        },
        {
          name: 'Duplicates',
          tab: 'case-overview-duplicates'
        }
      ]
    },
    {
      name: 'QC Failure',
      icon: ClockIcon,
      tab: 'qc-failure',
      requireRole: ['admin', 'moderator'],
      subItems: [
        {
          name: 'Order Number Cleaner',
          tab: 'qc-failure-order-cleaner',
          requireRole: ['admin', 'moderator']
        },
        {
          name: 'Case Number Cleaner',
          tab: 'qc-failure-case-cleaner',
          requireRole: ['admin', 'moderator']
        },
        {
          name: 'Salesforce Query',
          tab: 'qc-failure-salesforce-query',
          requireRole: ['admin', 'moderator']
        },
        {
          name: 'Combined ID',
          tab: 'qc-failure-combined-id',
          requireRole: ['admin', 'moderator']
        },
        {
          name: 'QC Failure Cases',
          tab: 'qc-failure-cases',
          requireRole: ['admin', 'moderator']
        }
      ]
    },
    { name: 'Champs', icon: UserGroupIcon, tab: 'champs', requireRole: ['admin', 'moderator'] },
    { name: 'User Management', icon: UserGroupIcon, tab: 'users', requireAdmin: true },
    { name: 'Settings', icon: Cog6ToothIcon, tab: 'settings' },
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
              if (item.hidden) {
                return null;
              }

              if (item.requireAdmin && userRole !== 'admin') {
                return null;
              }

              if (item.requireRole && !item.requireRole.includes(userRole.toLowerCase())) {
                return null;
              }

              const isExpanded = expandedItems[item.name];
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <div key={item.name}>
                  <button
                    onClick={() => {
                      if (hasSubItems) {
                        toggleExpand(item.name);
                      } else {
                        setActiveTab(item.tab);
                      }
                    }}
                    className={`${
                      (activeTab === item.tab && !hasSubItems) || (hasSubItems && item.subItems.some(sub => activeTab === sub.tab))
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    } group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium`}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={`${
                          activeTab === item.tab
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
                            onClick={() => setActiveTab(subItem.tab)}
                            className={`${
                              activeTab === subItem.tab
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
