create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '',
  birth_date date not null,
  gender text check (gender in ('남', '여')),
  gu text not null default '',
  dong text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

revoke all on public.user_profiles from public, anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;

create policy "Users can read their profile"
on public.user_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their profile"
on public.user_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their profile"
on public.user_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
