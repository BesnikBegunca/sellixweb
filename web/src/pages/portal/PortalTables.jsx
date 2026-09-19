import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { TablesGrid } from './SalesReport';

export default function PortalTables() {
  const { business } = usePortal();
  const [floor, setFloor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.isRestaurant) return undefined;
    let cancelled = false;
    setLoading(true);
    api.portalTables()
      .then((data) => {
        if (cancelled) return;
        setFloor(data);
        setError('');
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
  }, [business?.isRestaurant]);

  if (!business?.isRestaurant) return <Navigate to="/portal" replace />;
  if (error) return <div className="ad-error">{error}</div>;
  if (loading && !floor) return <div className="ad-hint">Duke ngarkuar tavolinat…</div>;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <h1 className="ad-heading pt-title">Tavolinat</h1>
      </div>
      <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Vetëm tavolinat me porosi të printuar. Kur paguhet, tavolina hiqet; kur printohet përsëri, del këtu.
      </p>
      <TablesGrid
        tables={floor?.tables}
        occupied={floor?.occupied}
        free={0}
        openTotal={floor?.openTotal}
      />
    </div>
  );
}
