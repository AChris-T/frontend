'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Route } from 'lucide-react';
import { loginUser } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

export default function LoginForm({ nextPath }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser(form);
      toast.success(`Welcome back, ${res.data.user.full_name.split(' ')[0]}!`);
      router.push(nextPath || (res.data.user.role === 'admin' ? '/admin' : '/dashboard'));
      router.refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Route className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome Back</h1>
          <p className="text-sm text-ink-muted">Sign in to track your reports</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="your@email.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              placeholder="Enter your password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">Sign In</Button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-muted">
          <p>Don&apos;t have an account? <Link href="/register" className="font-semibold text-brand">Create one free</Link></p>
          <p className="mt-2">Just want to report a fault? <Link href="/report" className="font-semibold text-good">Report without account</Link></p>
        </div>
      </Card>
    </div>
  );
}
