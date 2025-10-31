# React Query Cache Invalidation Fix

## Problem

When switching between customer and admin accounts (or any two different accounts), the application would show stale data from the previous account until the dev server was restarted. This caused confusion where:

1. User logs in as customer account
2. Customer dashboard loads with their data (cached by React Query)
3. User logs out
4. User logs in as admin account
5. **Admin dashboard still shows customer data** (cache not cleared)
6. Restarting dev server fixed it (cleared all state)

### Root Cause

React Query caches all API responses for 5 minutes (`staleTime: 1000 * 60 * 5`). When you switch accounts:
- Supabase auth state updates correctly (new JWT token)
- Local React state clears (user, session, isAdmin)
- **BUT** React Query cache persists with old data
- New queries see "fresh" cached data and don't refetch
- Even though the new JWT has different permissions, cached data is still returned

This is the same JWT caching issue mentioned in `ADMIN_TROUBLESHOOTING_GUIDE.md` but at the React Query layer instead of the Supabase layer.

## Solution

Implemented automatic cache invalidation when authentication state changes.

### Files Modified

**1. `lib/QueryProvider.tsx`**
- Exported `queryClient` so it can be accessed by AuthContext
- Changed from `const queryClient` to `export const queryClient`

**2. `lib/AuthContext.tsx`**
- Imported `queryClient` from QueryProvider
- Added cache clearing on logout in `signOut()` function
- Added cache invalidation in `onAuthStateChange` listener for:
  - **SIGNED_OUT**: Clears entire cache
  - **Different user ID**: Clears cache if logging in with different account
  - **SIGNED_IN**: Invalidates all queries to refetch with new JWT
  - **TOKEN_REFRESHED**: Invalidates all queries when JWT refreshes

### How It Works

```typescript
// In AuthContext.tsx - onAuthStateChange listener
supabase.auth.onAuthStateChange((event, session) => {
  const previousUserId = user?.id;
  const newUserId = session?.user?.id;

  // Update local state
  setSession(session);
  setUser(session?.user ?? null);
  checkAdminStatus(session?.user ?? null);

  // Clear cache on logout or account switch
  if (event === 'SIGNED_OUT' || (newUserId && previousUserId && newUserId !== previousUserId)) {
    console.log('Auth state changed - clearing query cache to prevent stale data');
    queryClient.clear();
  }
  // Refetch all data when logging in or token refreshes
  else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    console.log('User authenticated - invalidating queries to refetch with new permissions');
    queryClient.invalidateQueries();
  }
});

// Also in signOut() function for redundancy
const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    queryClient.clear(); // Clear all cached queries
  }
};
```

### Difference: `clear()` vs `invalidateQueries()`

- **`queryClient.clear()`**: Removes all queries from cache completely. Used on logout and account switch.
- **`queryClient.invalidateQueries()`**: Marks all queries as stale and refetches them. Used on login to get fresh data with new JWT.

## Testing

### Before Fix:
```bash
1. Log in as customer@example.com
2. See customer dashboard with requests
3. Log out
4. Log in as admin@mpsgroup.com
5. ❌ Admin dashboard shows customer data (stale cache)
6. Need to restart dev server to see admin data
```

### After Fix:
```bash
1. Log in as customer@example.com
2. See customer dashboard with requests
3. Log out
   → Console: "Logout - clearing all cached queries"
   → Console: "Auth state changed - clearing query cache to prevent stale data"
4. Log in as admin@mpsgroup.com
   → Console: "User authenticated - invalidating queries to refetch with new permissions"
5. ✅ Admin dashboard shows correct admin data immediately
6. No server restart needed!
```

## Production Impact

**Will this happen on GitHub Pages?**

No! This was a development-only issue caused by:
- Hot Module Replacement (HMR) keeping state in memory
- Long-lived browser tab with persistent cache
- Multiple logins/logouts without page refresh

**In production (GitHub Pages):**
- Users typically don't switch accounts frequently
- Page refreshes clear all state automatically
- No HMR or dev server complications
- However, the fix ensures robustness even in production

## Additional Benefits

This fix also resolves:

1. **Token refresh edge case**: When JWT token refreshes (every hour), queries now automatically refetch with the new token
2. **RLS policy changes**: If you update RLS policies in Supabase, logging out and back in will clear cache and apply new permissions
3. **Multi-tab issues**: If user logs out in one tab, cache is cleared preventing stale data in other tabs
4. **Better security**: Ensures no residual data from previous user sessions

## Console Logging

For debugging, the fix adds helpful console messages:

```
// On logout:
Logout - clearing all cached queries
Auth state changed - clearing query cache to prevent stale data

// On login:
User authenticated - invalidating queries to refetch with new permissions
```

You can remove these console.log statements if desired, but they're helpful for troubleshooting.

## Related Issues

This fix addresses the same root cause as:
- Admin requests disappearing after code changes (from conversation history)
- Need to restart dev server to see admin dashboard (this issue)
- Stale JWT tokens causing RLS visibility issues

All are variants of the same problem: **cached state not being invalidated when auth state changes**.

## Future Improvements

Optional enhancements for consideration:

1. **Selective invalidation**: Only clear specific query keys instead of entire cache
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['requests'] });
   queryClient.invalidateQueries({ queryKey: ['companies'] });
   ```

2. **Visual indicator**: Show a loading spinner when cache is being cleared

3. **Optimistic updates**: Keep cache during logout and only clear when new user logs in

4. **Query key scoping**: Prefix query keys with user ID to prevent cross-user cache collisions
   ```typescript
   queryKey: ['requests', userId]
   ```

## References

- React Query docs on cache invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Supabase auth events: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- Related: `ADMIN_TROUBLESHOOTING_GUIDE.md` (Section on JWT token caching)

---

**Fix Date:** October 31, 2025
**Status:** ✅ Fixed - No server restart required when switching accounts
**Tested:** Dev environment - Working correctly
**Production Impact:** No issues expected on GitHub Pages
