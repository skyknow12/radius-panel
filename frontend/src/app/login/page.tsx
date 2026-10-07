'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LoginView } from '@/components/login-view';

export default function LoginPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/');
  };

  return <LoginView onLoginSuccess={handleSuccess} />;
}
