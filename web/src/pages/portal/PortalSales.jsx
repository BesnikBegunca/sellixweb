import { useCallback, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { useLiveRefresh } from '../../lib/useLiveRefresh';
import { localDate, periodQuery } from '../../lib/sales';
import { PeriodPills, TotalsGrid, SalesCharts, PaymentsList, ProductsList, SalesList, LiveBadge, TodayRing } from './SalesReport';

export default function PortalSales() {
  const { business } = usePortal();
  const isRestaurant = !!business?.isRestaurant;
  const date = localDate();
  const [period, setPeriod] = useState('today');
  const [chartMode, setChartMode] = useState('days');
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Switching period starts a new load while the old one may still be in the
  // air; only the newest request is allowed to write state.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const q = periodQuery(period, date);
    try {
      const [ov, br, sl] = await Promise.all([
        api.portalOverview(date),
        api.portalBreakdown(q),
        api.portalSales(q)
      ]);
      if (id !== requestId.current) return;
      setOverview(ov);
      setBreakdown(br);
      setSales(sl.sales);
      setError('');
    } catch (e) {
      if (id === requestId.current) setError(e.message);
      throw e;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [period, date]);

  const { lastUpdated, live } = useLiveRefresh(load, { deps: [period, date], stream: '/portal/stream' });

  if (error && !overview) return <div className="ad-error">{error}</div>;
  if (loading && !overview) return <div className="ad-hint">Duke ngarkuar shitjet…</div>;

  const hasAny = (overview?.totals?.all?.count || 0) > 0;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div className="pt-live-row">
          <h1 className="ad-heading pt-title">Shitjet</h1>
          <LiveBadge live={live} lastUpdated={lastUpdated} />
        </div>
        <PeriodPills period={period} onChange={setPeriod} />
      </div>
      {/* A failed refresh keeps the last good numbers on screen; the banner
          says they may have stopped moving. */}
      {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
      {!hasAny && (
        <div className="ad-card pt-panel">
          <div className="pt-empty">
            {isRestaurant
              ? 'Nuk ka shitje të sinkronizuara ende. Mbyll një tavolinë ose një faturë në POS — faqja përditësohet vetë.'
              : 'Nuk ka shitje të sinkronizuara ende. Lësho faturën e parë në arkë — faqja përditësohet vetë.'}
          </div>
        </div>
      )}
      <TodayRing
        totals={overview?.totals}
        goal={overview?.goal}
        onSaveGoal={async (value) => {
          const { goal } = await api.portalSetGoal(value);
          setOverview((prev) => (prev ? { ...prev, goal } : prev));
        }}
      />
      <TotalsGrid totals={overview?.totals} />
      <SalesCharts breakdown={breakdown} chartMode={chartMode} onChartModeChange={setChartMode} />
      <div className="pt-split">
        <PaymentsList payments={breakdown?.payments} />
        <ProductsList products={breakdown?.products} />
      </div>
      <SalesList sales={sales} isRestaurant={isRestaurant} />
    </div>
  );
}
