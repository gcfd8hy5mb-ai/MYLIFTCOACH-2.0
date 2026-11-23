-- Synthetic fixture. No production connection or records.
create role anon;
create role authenticated;
create schema auth;
create schema mlc2_private;
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
grant usage on schema auth, mlc2_private to authenticated;
create table mlc2_private.records (
 user_id uuid not null, record_type text not null, record_id text not null,
 revision bigint not null, payload jsonb not null, deleted_at timestamptz,
 updated_at timestamptz not null, primary key(user_id,record_type,record_id)
);
create table mlc2_private.receipts (
 user_id uuid not null, op_id uuid not null, record_type text not null,
 record_id text not null, request_hash text not null, revision bigint not null,
 primary key(user_id,op_id)
);
alter table mlc2_private.records enable row level security;
alter table mlc2_private.receipts enable row level security;
grant select, insert, update on mlc2_private.records to authenticated;
grant select, insert on mlc2_private.receipts to authenticated;
create policy records_read on mlc2_private.records for select to authenticated
 using ((select auth.uid())=user_id);
create policy records_insert on mlc2_private.records for insert to authenticated
 with check ((select auth.uid())=user_id);
create policy records_write on mlc2_private.records for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy receipts_read on mlc2_private.receipts for select to authenticated
 using ((select auth.uid())=user_id);
create policy receipts_write on mlc2_private.receipts for insert to authenticated
 with check ((select auth.uid())=user_id);

-- Stand in for the installed signature and ACL before loading the prior body.
create function public.mlc2_v1_commit(p_op_id uuid,p_type text,p_record_id text,p_base_revision bigint,p_deleted boolean,p_payload jsonb)
returns jsonb language sql as $$select null::jsonb$$;
revoke execute on function public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb) from public, anon;
grant execute on function public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb) to authenticated;
