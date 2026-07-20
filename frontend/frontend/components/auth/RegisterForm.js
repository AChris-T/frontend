'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { registerUser } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

export default function RegisterForm() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await registerUser({ full_name: form.full_name, email: form.email, password: form.password });
      toast.success('Account created!');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Create Account</h1>
          <p className="text-sm text-ink-muted">Track your reports and get email updates</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Full Name">
            <Input placeholder="Akinfenwa Taiwo" required
              value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Email Address">
            <Input type="email" placeholder="your@email.com" required
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password">
            <Input type="password" placeholder="At least 6 characters" required
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Confirm Password">
            <Input type="password" placeholder="Repeat your password" required
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </Field>
          <Button type="submit" loading={loading} className="w-full">Create Account</Button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-muted">
          <p>Already have an account? <Link href="/login" className="font-semibold text-brand">Sign in</Link></p>
          <p className="mt-2">Just want to report? <Link href="/report" className="font-semibold text-good">Report without account</Link></p>
        </div>
      </Card>
    </div>
  );
}
