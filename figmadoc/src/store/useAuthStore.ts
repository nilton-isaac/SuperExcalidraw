import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { CloudBoardMeta } from '../types';

// BoardSnapshot shape espelhada aqui para evitar import circular
// (o tipo real vive em useStore.ts como interface interna)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BoardSnapshot = Record<string, any>;

export interface SavedBoardForCloud {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: BoardSnapshot;
  cloudId?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStore {
  user: User | null;
  session: Session | null;
  status: AuthStatus;

  cloudBoards: CloudBoardMeta[];
  cloudBoardsLoading: boolean;
  cloudError: string | null;

  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  fetchCloudBoards: () => Promise<void>;
  pushBoardToCloud: (board: SavedBoardForCloud) => Promise<string>;
  pullBoardFromCloud: (cloudId: string) => Promise<{ snapshot: BoardSnapshot; name: string; localId: string }>;
  deleteCloudBoard: (cloudId: string) => Promise<void>;
  clearCloudError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  status: 'loading',
  cloudBoards: [],
  cloudBoardsLoading: false,
  cloudError: null,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'unauthenticated' });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    });

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      set({
        session: nextSession,
        user: nextSession?.user ?? null,
        status: nextSession ? 'authenticated' : 'unauthenticated',
        cloudBoards: nextSession ? get().cloudBoards : [],
      });
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signInWithMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ cloudBoards: [], cloudError: null });
  },

  fetchCloudBoards: async () => {
    set({ cloudBoardsLoading: true, cloudError: null });
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, local_id, name, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      set({ cloudBoards: (data ?? []) as CloudBoardMeta[], cloudBoardsLoading: false });
    } catch (err) {
      set({ cloudBoardsLoading: false, cloudError: (err as Error).message });
    }
  },

  pushBoardToCloud: async (board) => {
    set({ cloudError: null });
    const user = get().user;
    if (!user) throw new Error('Não autenticado');

    const { data, error } = await supabase
      .from('boards')
      .upsert(
        {
          local_id: board.id,
          name: board.name,
          updated_at: board.updatedAt,
          snapshot: board.snapshot,
          user_id: user.id,
        },
        { onConflict: 'user_id,local_id' }
      )
      .select('id')
      .single();

    if (error) {
      set({ cloudError: error.message });
      throw error;
    }

    await get().fetchCloudBoards();
    return data.id as string;
  },

  pullBoardFromCloud: async (cloudId) => {
    set({ cloudError: null });
    const { data, error } = await supabase
      .from('boards')
      .select('snapshot, name, local_id, updated_at')
      .eq('id', cloudId)
      .single();

    if (error) {
      set({ cloudError: error.message });
      throw error;
    }

    return {
      snapshot: data.snapshot as BoardSnapshot,
      name: data.name as string,
      localId: data.local_id as string,
    };
  },

  deleteCloudBoard: async (cloudId) => {
    set({ cloudError: null });
    const { error } = await supabase.from('boards').delete().eq('id', cloudId);
    if (error) {
      set({ cloudError: error.message });
      throw error;
    }
    await get().fetchCloudBoards();
  },

  clearCloudError: () => set({ cloudError: null }),
}));
