/**
 * Supabase compatibility layer — now routes through our backend API
 * This makes it so pages that still use `supabase.from("favorites").select()`
 * will actually get real data from the backend.
 */

import * as api from "./api";
import { loginUser, registerUser, getMe } from "./api";

function getToken(): string | null {
  return localStorage.getItem("musika-token-v3");
}

// Map table names to API functions
const TABLE_HANDLERS: Record<string, {
  select: (token: string, filterField?: string | null, filterValue?: any) => Promise<any[]>;
  insert: (token: string, data: any) => Promise<any>;
  delete: (token: string, field: string, value: any) => Promise<void>;
  update: (token: string, field: string, value: any, data: any) => Promise<void>;
}> = {
  favorites: {
    select: async () => { return (await api.getFavorites()) as any; },
    insert: async (_, data) => { await api.addFavorite(data); return { data: null, error: null }; },
    delete: async (_, field, value) => {
      if (field === "user_id") return;
      if (field === "video_id") { await api.removeFavorite(value); }
    },
    update: async () => {},
  },
  play_history: {
    select: async () => { return (await api.getHistory()) as any; },
    insert: async (_, data) => { await api.addHistory(data); return { data: null, error: null }; },
    delete: async (_, field, value) => {
      if (field === "user_id") { await api.clearHistory(); }
    },
    update: async () => {},
  },
  playlists: {
    select: async () => { return (await api.getPlaylists()) as any; },
    insert: async (_, data) => { await api.createPlaylist(data); return { data: null, error: null }; },
    delete: async (_, field, value) => {
      if (field === "id") { await api.deletePlaylist(value); }
    },
    update: async (_, field, value, data) => {
      if (field === "id") { await api.updatePlaylist(value, data); }
    },
  },
  playlist_songs: {
    select: async (_, __, filterField, filterValue) => {
      // For playlist_songs, try to get songs from the playlist if we have a playlist_id filter
      if (filterField === 'playlist_id' && filterValue) {
        try {
          const res = await api.getPlaylist(filterValue);
          if (res.success && res.songs) return res.songs;
        } catch {}
      }
      return [];
    },
    insert: async () => ({ data: null, error: null }),
    delete: async () => {},
    update: async () => {},
  },
  user_downloads: {
    select: async () => { return (await api.getDownloads()) as any; },
    insert: async (_, data) => { await api.addDownload(data); return { data: null, error: null }; },
    delete: async (_, field, value) => {
      if (field === "id") { await api.deleteDownload(value); }
    },
    update: async () => {},
  },
  user_profiles: {
    select: async (_, __, filterField, filterValue) => {
      if (filterField === 'id' && filterValue) {
        try {
          const res = await api.getUserProfile(filterValue);
          if (res.success && res.profile) return [res.profile];
        } catch {}
      }
      return [];
    },
    insert: async () => ({ data: null, error: null }),
    delete: async () => {},
    update: async () => {},
  },
  search_history: {
    select: async () => [],
    insert: async () => ({ data: null, error: null }),
    delete: async () => {},
    update: async () => {},
  },
};

export const supabase: any = {
  from: (table: string) => {
    const handler = TABLE_HANDLERS[table];
    if (!handler) {
      console.warn(`[supabase compat] Unknown table: ${table}`);
      return createNoopQuery();
    }
    return createQuery(table, handler);
  },
  auth: {
    getSession: async () => {
      const token = getToken();
      if (!token) return { data: { session: null }, error: null };
      try {
        const res = await getMe();
        if (res.success && res.user) {
          return { data: { session: { user: res.user, access_token: token } }, error: null };
        }
      } catch {}
      return { data: { session: null }, error: null };
    },
    signUp: async ({ email, password, options }: any) => {
      try {
        const res = await registerUser(email, password, options?.data?.username || email.split("@")[0]);
        if (res.success && res.token) {
          localStorage.setItem("musika-token-v3", res.token);
          return { data: { user: res.user, session: { user: res.user, access_token: res.token } }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: res.error || "Registration failed" } };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await loginUser(email, password);
        if (res.success && res.token) {
          localStorage.setItem("musika-token-v3", res.token);
          return { data: { user: res.user, session: { user: res.user, access_token: res.token } }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: res.error || "Login failed" } };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },
    signOut: async () => {
      localStorage.removeItem("musika-token-v3");
      return { error: null };
    },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
};

function createNoopQuery() {
  return {
    select: () => ({
      eq: () => ({ single: async () => ({ data: null, error: null }), order: async () => [], then: (r: any) => r([]) }),
      order: async () => [],
      then: (r: any) => r([]),
    }),
    insert: async () => ({ data: null, error: null }),
    delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
  };
}

function createQuery(table: string, handler: typeof TABLE_HANDLERS[string]) {
  let filterField: string | null = null;
  let filterValue: any = null;
  let orderField: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;
  let selectedData: any[] | null = null;
  let selectColumns: string | null = null;

  const query: any = {
    select: (columns?: string) => {
      selectColumns = columns;
      return {
        eq: (field: string, value: any) => {
          filterField = field;
          filterValue = value;
          return {
            single: async () => {
              const data = await query.then((r: any) => r);
              const row = data?.find?.((d: any) => d[field] === value);
              return { data: row || null, error: null };
            },
            order: (col: string, opts?: any) => {
              orderField = col;
              orderAsc = opts?.ascending !== false;
              return query;
            },
            limit: (n: number) => {
              limitCount = n;
              return {
                then: (resolve: any) => query.then(resolve),
              };
            },
            then: (resolve: any) => {
              return query.then(resolve);
            },
          };
        },
        order: (col: string, opts?: any) => {
          orderField = col;
          orderAsc = opts?.ascending !== false;
          return query;
        },
        limit: (n: number) => {
          limitCount = n;
          return {
            then: (resolve: any) => query.then(resolve),
          };
        },
        then: (resolve: any) => {
          return query.then(resolve);
        },
      };
    },
    insert: async (data: any) => {
      try {
        await handler.insert(getToken() || "", data);
      } catch {}
      return { data: null, error: null };
    },
    delete: () => ({
      eq: async (field: string, value: any) => {
        try {
          await handler.delete(getToken() || "", field, value);
        } catch {}
        return { data: null, error: null };
      },
    }),
    update: (data: any) => ({
      eq: async (field: string, value: any) => {
        try {
          await handler.update(getToken() || "", field, value, data);
        } catch {}
        return { data: null, error: null };
      },
    }),
    then: async (resolve: any) => {
      try {
        const token = getToken() || "";
        const allData = await handler.select(token, filterField, filterValue);
        let filtered = allData;

        // Map snake_case DB fields to camelCase for compatibility with pages
        filtered = filtered.map((item: any) => {
          if (!item) return item;
          const mapped: any = { ...item };
          // Map video_id -> videoId (used by Favorites, History, Playlists, etc.)
          if (item.video_id && !item.videoId) mapped.videoId = item.video_id;
          // Map liked_at -> likedAt
          if (item.liked_at && !item.likedAt) mapped.likedAt = item.liked_at;
          // Map played_at -> playedAt
          if (item.played_at && !item.playedAt) mapped.playedAt = item.played_at;
          // Map added_at -> addedAt
          if (item.added_at && !item.addedAt) mapped.addedAt = item.added_at;
          // Map downloaded_at -> downloadedAt
          if (item.downloaded_at && !item.downloadedAt) mapped.downloadedAt = item.downloaded_at;
          // Map user_id -> userId
          if (item.user_id && !item.userId) mapped.userId = item.user_id;
          // Map cover_url -> coverUrl
          if (item.cover_url && !item.coverUrl) mapped.coverUrl = item.cover_url;
          // Map avatar_url -> avatarUrl
          if (item.avatar_url && !item.avatarUrl) mapped.avatarUrl = item.avatar_url;
          // Map cdn_url -> cdnUrl
          if (item.cdn_url && !item.cdnUrl) mapped.cdnUrl = item.cdn_url;
          // Map is_public -> isPublic
          if (item.is_public !== undefined && item.isPublic === undefined) mapped.isPublic = item.is_public;
          // Map created_at -> createdAt
          if (item.created_at && !item.createdAt) mapped.createdAt = item.created_at;
          return mapped;
        });

        // Apply eq filter
        if (filterField && filterValue !== null) {
          filtered = filtered.filter((d: any) => d[filterField] === filterValue);
        }

        // Apply order
        if (orderField) {
          filtered.sort((a: any, b: any) => {
            const aVal = a[orderField!] || "";
            const bVal = b[orderField!] || "";
            return orderAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
          });
        }

        // Apply limit
        if (limitCount && filtered.length > limitCount) {
          filtered = filtered.slice(0, limitCount);
        }

        return resolve({ data: filtered, error: null });
      } catch {
        return resolve({ data: [], error: null });
      }
    },
  };

  return query;
}

export default supabase;
