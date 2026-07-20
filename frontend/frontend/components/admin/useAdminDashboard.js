'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAdminDashboard, getAdminReports, getRoadReports, updateReportStatus, deleteReport } from '@/lib/api';

export function useAdminDashboard(initialStats, initialReports) {
  const [stats, setStats] = useState(initialStats);
  const [reports, setReports] = useState(initialReports);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [roadReports, setRoadReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsRes, reportsRes] = await Promise.all([getAdminDashboard(), getAdminReports()]);
      setStats(statsRes.data);
      setReports(reportsRes.data);
      setLastRefresh(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRoadClick = useCallback(async (road) => {
    setSelectedRoad(road);
    setRoadReports([]);
    try {
      const res = await getRoadReports(road.id);
      setRoadReports(res.data.reports || []);
    } catch {
      setRoadReports([]);
    }
  }, []);

  const closeRoad = () => { setSelectedRoad(null); setRoadReports([]); };

  const handleUpdate = async (reportId, status) => {
    setUpdating(reportId);
    try {
      await toast.promise(updateReportStatus(reportId, { status, note: '' }), {
        loading: 'Updating status…',
        success: 'Status updated',
        error: (err) => err.response?.data?.detail || 'Failed to update status',
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
      setRoadReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
      setSelectedReport((prev) => (prev?.id === reportId ? { ...prev, status } : prev));
      fetchData();
    } catch {
      // toast.promise already surfaced the error
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (reportId) => {
    setDeleting(reportId);
    try {
      await toast.promise(deleteReport(reportId), {
        loading: 'Deleting report…',
        success: 'Report deleted',
        error: (err) => err.response?.data?.detail || 'Failed to delete report',
      });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setRoadReports((prev) => prev.filter((r) => r.id !== reportId));
      setSelectedReport((prev) => (prev?.id === reportId ? null : prev));
      fetchData();
    } catch {
      // toast.promise already surfaced the error
    } finally {
      setDeleting(null);
    }
  };

  return {
    stats, reports, selectedRoad, roadReports, selectedReport, setSelectedReport,
    updating, deleting, refreshing, lastRefresh,
    fetchData, handleRoadClick, closeRoad, handleUpdate, handleDelete,
  };
}
