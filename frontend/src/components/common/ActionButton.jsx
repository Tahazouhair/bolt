import React from 'react';

const ActionButton = ({ 
  onClick, 
  disabled = false, 
  variant = 'primary', // primary, secondary, danger
  size = 'normal', // small, normal
  children 
}) => {
  const baseClasses = "inline-flex items-center border border-transparent font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:ring-indigo-500",
    secondary: "text-gray-700 bg-white border-gray-200 hover:bg-gray-50 focus:ring-indigo-500",
    danger: "text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500"
  };

  const sizeClasses = {
    small: "px-3 py-1.5 text-xs",
    normal: "px-4 py-2 text-sm"
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
};

export default ActionButton;
