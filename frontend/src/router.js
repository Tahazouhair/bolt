import { createHashRouter } from 'react-router-dom';
import App from './App';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Champs from './components/Champs';
import CaseOverview from './components/CaseOverview';
import AccessDenied from './components/AccessDenied';
import EligibilityChecker from './components/EligibilityChecker';

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
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
        path: '/access-denied',
        element: <AccessDenied />,
      },
      {
        path: '/qc-failure-salesforce-query',
        element: <EligibilityChecker />,
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
