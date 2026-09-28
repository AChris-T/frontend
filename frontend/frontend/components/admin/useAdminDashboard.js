'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getAdminDashboard, getAdminReports, getRoadReports, updateReportStatus, deleteReport,
  bulkUpdateStatus, bulkDeleteReports, rescanReport, startRescan, getRescanStatus,
  startGeocode, getGeocodeStatus, geocodeReport,
} from '@/lib/api';

const errorText = (err, fallback) => err?.response?.data?.detail || fallback;

/** Polls a background job's status while it runs; fires onProgress / onFinish. */
function useJob(fetchStatus, { onFinish, onProgress }) {
  const [job, setJob] = useState({ running: false });
  const timer = useRef(null);
  const last = useRef({ running: false, done: 0 });
  const handlers = useRef({ onFinish, onProgress });
  const pollRef = useRef(null);

  useEffect(() => { handlers.current = { onFinish, onProgress }; });

  const poll = useCallback(async () => {
    clearTimeout(timer.current);
    let delay = null;
    try {
      const { data } = await fetchStatus();
      setJob(data);
      const prev = last.current;
      if (data.running && (data.done || 0) !== prev.done) handlers.current.onProgress?.(data);
      if (prev.running && !data.running) handlers.current.onFinish?.(data);
      last.current = { running: !!data.running, done: data.done || 0 };
      if (data.running) delay = 2000;
    } catch {
      delay = 5000;
    }
    if (delay) timer.current = setTimeout(() => pollRef.current?.(), delay);
  }, [fetchStatus]);

  useEffect(() => {
    pollRef.current = poll;
    timer.current = setTimeout(() => pollRef.current?.(), 0);
    return () => clearTimeout(timer.current);
  }, [poll]);

  return [job, setJob, poll];
}

export function useAdminDashboard(initialStats, initialReports) {
  const [stats, setStats] = useState(initialStats);
  const [reports, setReports] = useState(initialReports);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [roadReportIds, setRoadReportIds] = useState(() => new Set());
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [rescanning, setRescanning] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  const fetchData = useCallback(async ({ silent = true } = {}) => {
    setRefreshing(true);
    try {
      const [statsRes, reportsRes] = await Promise.all([getAdminDashboard(), getAdminReports()]);
      setStats(statsRes.data);
      setReports(reportsRes.data);
      setLastRefresh(new Date());
      if (!silent) toast.success('Dashboard refreshed');
    } catch {
      if (!silent) toast.error('Could not refresh the dashboard');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRescanFinished = useCallback((job) => {
    if (job.stopped_reason) toast.error(job.stopped_reason, { duration: 10000 });
    else toast.success(`AI rescan complete — ${job.succeeded} rescanned, ${job.changed} changed${job.failed ? `, ${job.failed} failed` : ''}`, { duration: 6000 });
    fetchData();
  }, [fetchData]);
  const onGeocodeFinished = useCallback((job) => {
    toast.success(`Locations resolved for ${job.succeeded} report(s)`);
    fetchData();
  }, [fetchData]);

  // Refresh reports every few results so the table updates live during a bulk rescan.
  const onRescanProgress = useCallback((job) => {
    if (job.done % 5 === 0) fetchData();
  }, [fetchData]);

  const [rescanJob, setRescanJob, pollRescan] = useJob(getRescanStatus, { onFinish: onRescanFinished, onProgress: onRescanProgress });
  const [geocodeJob, setGeocodeJob, pollGeocode] = useJob(getGeocodeStatus, { onFinish: onGeocodeFinished });

  const handleRoadClick = useCallback(async (road) => {
    setSelectedRoad(road);
    setRoadReportIds(new Set());
    try {
      const res = await getRoadReports(road.id);
      const ids = new Set((res.data.reports || []).map((r) => r.id));
      setRoadReportIds(ids);
    } catch {
      setRoadReportIds(new Set());
    }
  }, []);

  const closeRoad = useCallback(() => { setSelectedRoad(null); setRoadReportIds(new Set()); }, []);

  const patchReports = (ids, patch) => {
    const set = new Set(ids);
    setReports((prev) => prev.map((r) => (set.has(r.id) ? { ...r, ...patch } : r)));
  };

  const handleUpdate = useCallback(async (reportId, status, note = '') => {
    setUpdating(reportId);
    try {
      await toast.promise(updateReportStatus(reportId, { status, note }), {
        loading: 'Updating status…',
        success: 'Status updated — reporter notified by email',
        error: (err) => errorText(err, 'Failed to update status'),
      });
      patchReports([reportId], { status, updated_at: new Date().toISOString() });
      fetchData();
    } catch {
      // toast.promise already surfaced the error
    } finally {
      setUpdating(null);
    }
  }, [fetchData]);

  const handleBulkUpdate = useCallback(async (ids, status) => {
    try {
      await toast.promise(bulkUpdateStatus(ids, status), {
        loading: `Updating ${ids.length} report(s)…`,
        success: `${ids.length} report(s) updated`,
        error: (err) => errorText(err, 'Bulk update failed'),
      });
      patchReports(ids, { status });
      fetchData();
      return true;
    } catch {
      return false;
    }
  }, [fetchData]);

  const handleDelete = useCallback(async (reportId) => {
    setDeleting(reportId);
    try {
      await toast.promise(deleteReport(reportId), {
        loading: 'Deleting report…',
        success: 'Report deleted',
        error: (err) => errorText(err, 'Failed to delete report'),
      });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSelectedReportId((prev) => (prev === reportId ? null : prev));
      fetchData();
    } catch {
      // toast.promise already surfaced the error
    } finally {
      setDeleting(null);
    }
  }, [fetchData]);

  const handleBulkDelete = useCallback(async (ids) => {
    try {
      await toast.promise(bulkDeleteReports(ids), {
        loading: `Deleting ${ids.length} report(s)…`,
        success: `${ids.length} report(s) deleted`,
        error: (err) => errorText(err, 'Bulk delete failed'),
      });
      const set = new Set(ids);
      setReports((prev) => prev.filter((r) => !set.has(r.id)));
      fetchData();
      return true;
    } catch {
      return false;
    }
  }, [fetchData]);

  const handleRescanOne = useCallback(async (reportId) => {
    setRescanning(reportId);
    try {
      const { data } = await rescanReport(reportId);
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...data.report } : r)));
      const s = data.summary;
      if (s.kept) {
        toast(`Gemini is unavailable right now (daily quota reached?), so #${reportId} kept its existing AI result`, { icon: '⚠️', duration: 7000 });
      } else if (s.changed) {
        toast.success(`AI updated #${reportId}: ${s.previous.fault_type?.replace(/_/g, ' ')} → ${s.fault_type?.replace(/_/g, ' ')}`, { duration: 5000 });
      } else {
        toast.success(s.fault_detected ? `AI confirmed #${reportId} (${Math.round((s.confidence || 0) * 100)}% confidence)` : `AI found no fault in #${reportId}`);
      }
      return data;
    } catch (err) {
      toast.error(errorText(err, 'AI rescan failed'));
      return null;
    } finally {
      setRescanning(null);
    }
  }, []);

  const handleStartRescan = useCallback(async (scope = 'all', ids = null) => {
    try {
      const { data } = await startRescan(scope, ids);
      setRescanJob(data);
      if (data.started === false) toast('A rescan is already running', { icon: '⏳' });
      else toast.success(`AI rescan started for ${data.total} report(s)`);
      pollRescan();
    } catch (err) {
      toast.error(errorText(err, 'Could not start the rescan'));
    }
  }, [pollRescan, setRescanJob]);

  const handleStartGeocode = useCallback(async (onlyMissing = true) => {
    try {
      const { data } = await startGeocode(onlyMissing);
      setGeocodeJob(data);
      if (!data.total) toast.success('Every report already has a location');
      else toast.success(`Resolving locations for ${data.total} report(s)`);
      pollGeocode();
    } catch (err) {
      toast.error(errorText(err, 'Could not start location lookup'));
    }
  }, [pollGeocode, setGeocodeJob]);

  const handleGeocodeOne = useCallback(async (reportId) => {
    try {
      const { data } = await geocodeReport(reportId);
      patchReports([reportId], data);
      toast.success('Location resolved');
    } catch (err) {
      toast.error(errorText(err, 'Could not resolve location'));
    }
  }, []);

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;

  return {
    stats, reports, selectedRoad, roadReportIds, selectedReport, selectedReportId, setSelectedReportId,
    updating, deleting, rescanning, refreshing, lastRefresh, rescanJob, geocodeJob,
    fetchData, handleRoadClick, closeRoad, handleUpdate, handleBulkUpdate, handleDelete, handleBulkDelete,
    handleRescanOne, handleStartRescan, handleStartGeocode, handleGeocodeOne,
  };
}
