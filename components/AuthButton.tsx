'use client';

import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { useAuthActions } from '@convex-dev/auth/react';
import { useState } from 'react';

export default function AuthButton() {
  const { isAuthenticated, isLoading, user } = useCurrentUser();
  const { signIn, signOut } = useAuthActions();
  const [authError, setAuthError] = useState<string | null>(null);
  const firstName = user?.name?.split(' ')[0] ?? 'Account';

  if (isLoading) {
    return <span className="opacity-60 h-9 items-center">Fetching account...</span>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setAuthError(null);
            void signIn('google').catch(() => {
              setAuthError('google auth is not configured');
            });
          }}
          className="display"
        >
          Sign in with Google
        </button>
        {authError && <span className="opacity-60">{authError}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span>{firstName}</span>
      <button onClick={() => void signOut()} className="display">
        Sign out
      </button>
    </div>
  );
}
