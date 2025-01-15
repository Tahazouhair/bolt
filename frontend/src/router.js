import { createHashRouter, Navigate } from 'react-router-dom';
import App, { PrivateRoute } from './App';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Champs from './components/Champs';
import CaseOverview from './components/CaseOverview';
import AccessDenied from './components/AccessDenied';

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: '/',
        element: <Navigate to="/login" replace />
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/dashboard',
        element: <PrivateRoute><Dashboard /></PrivateRoute>,
      },
      {
        path: '/champs',
        element: <PrivateRoute><Champs /></PrivateRoute>,
      },
      {
        path: '/case-overview',
        element: <PrivateRoute><CaseOverview /></PrivateRoute>,
      },
      {
        path: '/access-denied',
        element: <AccessDenied />,
      },
      {
        path: '*',
        element: <Navigate to="/login" replace />
      }
    ],
  },
], {
  enabledFutures: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
});

export default router;
