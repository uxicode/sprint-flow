'use client';

import AppShell from './components/layout/AppShell';
import { useSprintFlow } from './hooks/useSprintFlow';

export default function Home() {
  const app = useSprintFlow();

  if (!app.mounted) {
    return <div className="hydration-placeholder"></div>;
  }

  return <AppShell app={app} />;
}
