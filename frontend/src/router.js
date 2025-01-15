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
      {
        path: '/case-overview',
        element: <CaseOverview />,
      },
      {
        path: '/case-overview-all',
        element: <CaseOverview initialFilter="all" />,
      },
      {
        path: '/case-overview-assigned',
        element: <CaseOverview initialFilter="assigned" />,
      },
      {
        path: '/case-overview-unassigned',
        element: <CaseOverview initialFilter="unassigned" />,
      },
      {
        path: '/case-overview-other-qs',
        element: <CaseOverview initialFilter="other-qs" />,
      },
      {
        path: '/case-overview-my-cases',
        element: <CaseOverview initialFilter="my-cases" />,
      },
      {
        path: '/case-overview-high-priority',
        element: <CaseOverview initialFilter="high-priority" />,
      },
      {
        path: '/case-overview-duplicates',
        element: <CaseOverview initialFilter="duplicates" />,
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
