import { createHashRouter } from 'react-router-dom';
import App from './App';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Champs from './components/Champs';
import CaseOverview from './components/CaseOverview';
import AccessDenied from './components/AccessDenied';

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <AccessDenied />,
    children: [
      {
        path: '/',
        element: <Login />,
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/champs',
        element: <Champs />,
      },
      // Case Overview Routes
      {
        path: '/case-overview',
        element: <CaseOverview />,
      },
      {
        path: '/case-overview/all',
        element: <CaseOverview initialFilter="all" />,
      },
      {
        path: '/case-overview/assigned',
        element: <CaseOverview initialFilter="assigned" />,
      },
      {
        path: '/case-overview/unassigned',
        element: <CaseOverview initialFilter="unassigned" />,
      },
      {
        path: '/case-overview/other-qs',
        element: <CaseOverview initialFilter="other-qs" />,
      },
      {
        path: '/case-overview/my-cases',
        element: <CaseOverview initialFilter="my-cases" />,
      },
      {
        path: '/case-overview/high-priority',
        element: <CaseOverview initialFilter="high-priority" />,
      },
      {
        path: '/case-overview/duplicates',
        element: <CaseOverview initialFilter="duplicates" />,
      },
      // QC Failure Routes
      {
        path: '/qc-failure/order-cleaner',
        element: <AccessDenied />, // Placeholder until components are created
      },
      {
        path: '/qc-failure/case-cleaner',
        element: <AccessDenied />,
      },
      {
        path: '/qc-failure/salesforce-query',
        element: <AccessDenied />,
      },
      {
        path: '/qc-failure/combined-id',
        element: <AccessDenied />,
      },
      {
        path: '/qc-failure/cases',
        element: <AccessDenied />,
      },
      // Other Routes
      {
        path: '/activities',
        element: <AccessDenied />,
      },
      {
        path: '/analytics',
        element: <AccessDenied />,
      },
      {
        path: '/users',
        element: <AccessDenied />,
      },
      {
        path: '/settings',
        element: <AccessDenied />,
      },
      {
        path: '/access-denied',
        element: <AccessDenied />,
      },
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
