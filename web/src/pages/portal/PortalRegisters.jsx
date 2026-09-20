import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { useLiveRefresh } from '../../lib/useLiveRefresh';
import { localDate, periodQuery } from '../../lib/sales';
import { RegistersGrid, PeriodPills, LiveBadge } from './SalesReport';

// Markets get this page where restaurants get Tavolinat: the same live data,
// split by till instead of by table.
export default function PortalRegisters() {
  const { business } = usePortal();
  const isMarket = !business?.isRestaurant;
  const date = localDate();
  const [period, setPeriod] = useState('today');
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!isMarket) return;
    const id = ++requestId.current;
    try {
      const data = await api.portalDevices(periodQuery(period, date));
      if (id !== requestId.current) return;
      setDevices(data);
      setError('');
    } catch (e) {
      if (id === requestId.current) setError(e.message);
      throw e;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [isMarket, period, date]);

  const { lastUpdated, live } = useLiveRefresh(load, {
    deps: [isMarket, period, date],
    stream: isMarket ? '/portal/stream' : undefined
  });

  if (!isMarket) return <Navigate to="/portal" replace />;
  if (error && !devices) return <div className="ad-error">{error}</div>;
  if (loading && !devices) return <div className="ad-hint">Duke ngarkuar arkat…</div>;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div className="pt-live-row">
          <h1 className="ad-heading pt-title">Kompjuterët</h1>
          <LiveBadge live={live} lastUpdated={lastUpdated} />
        </div>
        <PeriodPills period={period} onChange={setPeriod} />
      </div>
      <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Sa para ka bërë secila arkë, nga të njëjtat faturë që kompjuterët dërgojnë. Numri i arkës është radha e
        aktivizimit, prandaj “Kompjuteri 2” mbetet i njëjti kompjuter edhe nesër.
      </p>
      {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
      <RegistersGrid data={devices} />
    </div>
  );
}
