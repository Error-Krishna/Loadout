import { useInRouterContext, MemoryRouter } from 'react-router-dom';
import AppShell from './components/layout/AppShell';

function AppContent() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <AppShell />;
  }
  return (
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>
  );
}

export default function App() {
  return <AppContent />;
}
