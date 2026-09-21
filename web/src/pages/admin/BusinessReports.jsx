import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import ReportsPanel, { reportPeriodOptions } from '../portal/ReportsPanel';

export default function BusinessReports({ businessId }) {
  const [kind, setKind] = useState('month');
  const [period, setPeriod] = useState(reportPeriodOptions('month')[0]?.value || '');
  const [preview, setPreview] = useState(null);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getBusinessReports(businessId);
      setReports(data.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!kind || !period) return undefined;
    let cancelled = false;
    api.getBusinessReportPreview(businessId, kind, period)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, kind, period]);

  const onCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const { report } = await api.createBusinessReport(businessId, kind, period);
      await api.downloadBusinessReport(businessId, report.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (report) => {
    setBusy(true);
    setError('');
    try {
      await api.downloadBusinessReport(businessId, report.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (report) => {
    if (!window.confirm('Ta fshish këtë raport?')) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteBusinessReport(businessId, report.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReportsPanel
      reports={reports}
      loading={loading}
      error={error}
      busy={busy}
      preview={preview}
      kind={kind}
      period={period}
      onKindChange={(next) => {
        setKind(next);
        setPeriod(reportPeriodOptions(next)[0]?.value || '');
      }}
      onPeriodChange={setPeriod}
      onCreate={onCreate}
      onDownload={onDownload}
      onDelete={onDelete}
    />
  );
}
