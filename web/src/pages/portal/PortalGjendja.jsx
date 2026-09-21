import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { useLiveRefresh } from '../../lib/useLiveRefresh';
import { GjendjaTable, LiveBadge } from './SalesReport';

export default function PortalGjendja() {
  const { business } = usePortal();
  const isRestaurant = !!business?.isRestaurant;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!isRestaurant) return;
    const id = ++requestId.current;
    try {
      const next = await api.portalShifts();
      if (id !== requestId.current) return;
      setData(next);
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
  if (error && !data) return <div className="ad-error">{error}</div>;
  if (loading && !data) return <div className="ad-hint">Duke ngarkuar gjendjen…</div>;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div className="pt-live-row">
          <h1 className="ad-heading pt-title">Gjendja</h1>
          <LiveBadge live={live} lastUpdated={lastUpdated} />
        </div>
      </div>
      <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Mbylljet e gjendjes nga kasa, me datën, orën, intervalin dhe totalin e çdo turni — si në desktop.
      </p>
      {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
      <GjendjaTable data={data} />
    </div>
  );
}
