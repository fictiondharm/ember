import { FleetProvider, useFleet } from './store/FleetContext';
import { ControlTower } from './views/ControlTower';
import { LiveMapView } from './views/LiveMapView';
import { Business } from './views/Business';
import { Driver } from './views/Driver';
import { Register } from './views/Register';
import { RoleSelect } from './views/RoleSelect';

function Router() {
  const { mode } = useFleet();
  if (mode === 'REGISTER') return <Register />;
  if (mode === 'CONTROL_TOWER') return <ControlTower />;
  if (mode === 'LIVE_MAP') return <LiveMapView />;
  if (mode === 'BUSINESS') return <Business />;
  if (mode === 'DRIVER') return <Driver />;
  return <RoleSelect />;
}

export default function App() {
  return (
    <FleetProvider>
      <Router />
    </FleetProvider>
  );
}
