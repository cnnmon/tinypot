'use client';

import { api } from '@/convex/_generated/api';
import { isAdminEmail } from '@/lib/auth/admins';
import { useQuery } from 'convex/react';
import { useConvexAuth } from 'convex/react';

export function useCurrentUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.viewer, {});

  return {
    isAuthenticated,
    isLoading: isLoading || (isAuthenticated && user === undefined),
    user: user ?? null,
    userId: user?._id ?? null,
    isAdmin: isAdminEmail(user?.email),
  };
}
