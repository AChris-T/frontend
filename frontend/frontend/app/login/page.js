import LoginForm from '@/components/auth/LoginForm';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginForm nextPath={params?.next || null} />;
}
