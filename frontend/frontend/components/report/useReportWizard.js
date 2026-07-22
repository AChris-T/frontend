'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { scanMedia, submitReport } from '@/lib/api';

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
    const file = e.target.files[0];
    if (!file) return;

    const type = file.type.startsWith('video') ? 'video' : 'photo';
    setMedia(file);
    setMediaType(type);
    setPreview(URL.createObjectURL(file));
    setStep(3);
    setScanning(true);
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lon);
      formData.append(type, file);

      const res = await scanMedia(formData);
      setAiResult(res.data);
      // AI's finding is authoritative here — there's no manual override step.
      setFaultType(res.data.fault_type || 'none');
      setSeverity(res.data.severity || 'none');
    } catch {
      setAiResult({ fault_detected: false, message: 'AI scan failed' });
      setFaultType('other');
      setSeverity('low');
      toast.error('AI scan failed — this report will be flagged for manual review');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lon);
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
