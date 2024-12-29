import React from 'react';

const AccessDenied = () => (
  <div className="bg-white shadow sm:rounded-lg">
    <div className="px-4 py-5 sm:p-6">
      <h3 className="text-lg font-medium leading-6 text-red-600">Access Denied</h3>
      <div className="mt-2 max-w-xl text-sm text-gray-500">
        <p>You don't have permission to access this section.</p>
      </div>
    </div>
  </div>
);

export default AccessDenied;
