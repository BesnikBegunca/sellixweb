import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { localDate, periodQuery } from '../../lib/sales';
import { PeriodPills, TotalsGrid, SalesCharts, PaymentsList, ProductsList, SalesList } from './SalesReport';

export default function PortalSales() {
  const date = localDate();
  const [period, setPeriod] = useState('today');
  const [chartMode, setChartMode] = useState('days');
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const q = periodQuery(period, date);
    Promise.all([
      api.portalOverview(date),
      api.portalBreakdown(q),
      api.portalSales(q)
    ])
      .then(([ov, br, sl]) => {
        if (cancelled) return;
        setOverview(ov);
        setBreakdown(br);
        setSales(sl.sales);
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
  }, [period, date]);

  if (error) return <div className="ad-error">{error}</div>;
  if (loading && !overview) return <div className="ad-hint">Duke ngarkuar shitjet…</div>;

  const hasAny = (overview?.totals?.all?.count || 0) > 0;

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <h1 className="ad-heading pt-title">Shitjet</h1>
        <PeriodPills period={period} onChange={setPeriod} />
      </div>
      {!hasAny && (
        <div className="ad-card pt-panel">
          <div className="pt-empty">
            Nuk ka shitje të sinkronizuara ende. Mbyll një tavolinë ose një faturë në POS, pastaj rifresko këtë faqe.
          </div>
        </div>
      )}
      <TotalsGrid totals={overview?.totals} />
      <SalesCharts breakdown={breakdown} chartMode={chartMode} onChartModeChange={setChartMode} />
      <div className="pt-split">
        <PaymentsList payments={breakdown?.payments} />
        <ProductsList products={breakdown?.products} />
      </div>
      <SalesList sales={sales} />
    </div>
  );
}
