-- ============================================================
-- SuperExcalidraw — Supabase Schema
-- Execute este script no SQL Editor do seu projeto Supabase:
--   https://supabase.com → SQL Editor → New query → Cole e rode
-- ============================================================

-- Tabela principal de boards
CREATE TABLE public.boards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id     TEXT NOT NULL,           -- UUID gerado pelo cliente (SavedBoard.id)
  name         TEXT NOT NULL,
  snapshot     JSONB NOT NULL,          -- Conteúdo completo da board (elementos, páginas, etc.)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante que cada usuário tem no máximo 1 registro por board local
  CONSTRAINT boards_user_local_unique UNIQUE (user_id, local_id)
);

-- Índice para listagem rápida por usuário ordenada por data
CREATE INDEX idx_boards_user_updated ON public.boards (user_id, updated_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS) — cada usuário só acessa seus dados
-- ============================================================
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boards_select_own"
  ON public.boards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "boards_insert_own"
  ON public.boards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "boards_update_own"
  ON public.boards FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "boards_delete_own"
  ON public.boards FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Função auxiliar: estatísticas de uso do usuário atual
-- Útil para mostrar quantas boards e quantos MB estão na nuvem
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_board_stats()
RETURNS TABLE(board_count INT, snapshot_bytes BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(octet_length(snapshot::TEXT)), 0)::BIGINT
  FROM public.boards
  WHERE user_id = auth.uid();
$$;
