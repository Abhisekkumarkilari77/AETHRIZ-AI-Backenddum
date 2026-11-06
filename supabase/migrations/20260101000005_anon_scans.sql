-- Migration 5: allow anonymous AI scans (no auth required)
alter table public.health_analyses
  drop constraint health_analyses_user_id_fkey,
  alter column user_id drop not null;

alter table public.food_scans
  drop constraint food_scans_user_id_fkey,
  alter column user_id drop not null;
