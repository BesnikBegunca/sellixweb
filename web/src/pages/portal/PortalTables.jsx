import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { localDate, periodQuery } from '../../lib/sales';
import { PeriodPills, TablesGrid } from './SalesReport';

export default function PortalTables() {
  const { business } = usePortal();
  const date = localDate();
  const [period, setPeriod] = useState('today');
  const [tables, setTables] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.isRestaurant) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.portalTables(periodQuery(period, date))
      .then((data) => {
        if (!cancelled) setTables(data.tables);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, date, business?.isRestaurant]);

  if (!business?.isRestaurant) return <Navigate to="/portal" replace />;
  if (error) return <div className="ad-error">{error}</div>;
  if (loading && !tables) return <div className="ad-hint">Duke ngarkuar tavolinat…</div>;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <h1 className="ad-heading pt-title">Tavolinat</h1>
        <PeriodPills period={period} onChange={setPeriod} />
      </div>
      <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Totalet sipas tavolinës, nga të njëjtat faturë që arka dërgoi. Takeaway dhe banaku hyjnë te Shitjet, jo këtu.
      </p>
      <TablesGrid tables={tables} />
    </div>
  );
}
