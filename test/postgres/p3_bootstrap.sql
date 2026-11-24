\set ON_ERROR_STOP on
do $$ begin if current_database()<>'qswipe_test' then raise exception 'Disposable database required'; end if; end $$;
-- Extend the local Auth stub; no Supabase connection.
alter table auth.users add column email_confirmed_at timestamptz;
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
