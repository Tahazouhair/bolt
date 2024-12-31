import React, { startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import axios from 'axios';
import './index.css';
import router from './router';

// Configure axios defaults
axios.defaults.withCredentials = false;

// Disable console.log in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

const container = document.getElementById('root');
const root = createRoot(container);

startTransition(() => {
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
});
