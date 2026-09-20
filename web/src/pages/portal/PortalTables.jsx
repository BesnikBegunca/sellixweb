import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { useLiveRefresh } from '../../lib/useLiveRefresh';
import { TablesGrid, LiveBadge } from './SalesReport';

export default function PortalTables() {
  const { business } = usePortal();
  const isRestaurant = !!business?.isRestaurant;
  const [floor, setFloor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!isRestaurant) return;
    const id = ++requestId.current;
    try {
      const data = await api.portalTables();
      if (id !== requestId.current) return;
      setFloor(data);
      setError('');
    } catch (e) {
      if (id === requestId.current) setError(e.message);
      throw e;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [isRestaurant]);

  const { lastUpdated, live } = useLiveRefresh(load, {
    deps: [isRestaurant],
    stream: isRestaurant ? '/portal/stream' : undefined
  });

  if (!isRestaurant) return <Navigate to="/portal" replace />;
  if (error && !floor) return <div className="ad-error">{error}</div>;
  if (loading && !floor) return <div className="ad-hint">Duke ngarkuar tavolinat…</div>;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div className="pt-live-row">
          <h1 className="ad-heading pt-title">Tavolinat</h1>
          <LiveBadge live={live} lastUpdated={lastUpdated} />
        </div>
      </div>
      <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Totalet sipas tavolinës, nga të njëjtat faturë që arka dërgoi, të përditësuara vetvetiu sapo mbyllet një tavolinë.
        Takeaway dhe banaku hyjnë te Shitjet, jo këtu.
      </p>
      {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
      <TablesGrid tables={floor?.tables} />
    </div>
  );
}
