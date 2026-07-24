'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { scanMedia, submitReport } from '@/lib/api';

function readFilePreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file preview'));
    reader.readAsDataURL(file);
  });
}

export function useReportWizard(defaultEmail = '') {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(defaultEmail);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState('');
  const [preview, setPreview] = useState('');
  const [scanning, setScanning] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [faultType, setFaultType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reportId, setReportId] = useState(null);

  const getLocation = () => {
    setGettingLocation(true);
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device');
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGettingLocation(false);
        setStep(2);
      },
      () => {
        setLocationError('Could not get your location. Please allow location access.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!location) {
      toast.error('Location is required before uploading media');
      setStep(1);
      return;
    }

    const type = file.type.startsWith('video') ? 'video' : 'photo';
    setMedia(file);
    setMediaType(type);
    setStep(3);
    setScanning(true);
    setAiResult(null);

    try {
      const previewUrl = await readFilePreview(file);
      setPreview(previewUrl);
    } catch {
      setPreview('');
      toast.error('Could not preview this file, but scanning will continue');
    }

    try {
      const formData = new FormData();
      formData.append('latitude', String(location.lat));
      formData.append('longitude', String(location.lon));
      formData.append(type, file, file.name || (type === 'video' ? 'upload.mp4' : 'upload.jpg'));

      const res = await scanMedia(formData);
      const result = res.data || { fault_detected: false, message: 'Empty scan response' };
      setAiResult(result);
      setFaultType(result.fault_type || 'other');
      setSeverity(result.severity || 'low');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : err.response?.data?.message
          || (err.code === 'ECONNABORTED' ? 'Scan timed out — try a smaller photo' : 'AI scan failed');
      setAiResult({ fault_detected: false, message, all_detections: [] });
      setFaultType('other');
      setSeverity('low');
      toast.error(message);
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('latitude', String(location.lat));
      formData.append('longitude', String(location.lon));
      formData.append('fault_type', faultType);
      formData.append('severity', severity);
      if (description) formData.append('description', description);
      if (email) formData.append('email', email);
      if (media) formData.append(mediaType, media);
      if (aiResult) formData.append('ai_scan_result', JSON.stringify(aiResult));

      const res = await submitReport(formData);
      setReportId(res.data.report_id);
      setSuccess(true);
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setLocation(null);
    setMedia(null);
    setPreview('');
    setAiResult(null);
    setFaultType('');
    setSeverity('');
    setDescription('');
    setEmail(defaultEmail);
    setSuccess(false);
  };

  return {
    step, setStep, location, locationError, gettingLocation, getLocation,
    media, mediaType, preview, scanning, aiResult,
    faultType, severity, description, setDescription,
    email, setEmail,
    loading, success, reportId,
    handleFile, handleSubmit, reset,
  };
}
