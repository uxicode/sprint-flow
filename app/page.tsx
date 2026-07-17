'use client';

import AppShell from './components/layout/AppShell';
import { useAppBootstrap } from './hooks/use-app-bootstrap';

export default function Home() {
  const { mounted } = useAppBootstrap();

  if (!mounted) {
    return <div className="hydration-placeholder"></div>;
  }

  return <AppShell />;
}
