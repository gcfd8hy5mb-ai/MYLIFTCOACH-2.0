-- PROPOSAL ONLY. NOT APPLIED TO PRISM OR ANY LIVE PROJECT.
-- New isolated sync namespace; review, test with two disposable auth accounts,
-- and obtain explicit deployment approval before applying.
-- Dependencies: Supabase Auth, PostgREST RPC; mlc2_private is NOT exposed in Data API.
begin;
create schema if not exists mlc2_private;
revoke all on schema mlc2_private from public, anon;
grant usage on schema mlc2_private to authenticated;

create table if not exists mlc2_private.records (
 user_id uuid not null references auth.users(id) on delete cascade,
 record_type text not null check (record_type in ('session','custom-plan','tracking','measurement','meal','goal')),
 record_id text not null check (length(record_id) between 1 and 160),
 revision bigint not null check (revision >= 1),
 payload jsonb not null default '{}'::jsonb,
 deleted_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (user_id, record_type, record_id)
);
create table if not exists mlc2_private.receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null,
 record_type text not null,
 record_id text not null,
 request_hash text not null,
 revision bigint not null,
 created_at timestamptz not null default now(),
 primary key (user_id, op_id)
);
create index if not exists mlc2_receipts_created_idx
 on mlc2_private.receipts(user_id, created_at);
alter table mlc2_private.records enable row level security;
alter table mlc2_private.receipts enable row level security;
revoke all on mlc2_private.records, mlc2_private.receipts from public, anon;
grant select,insert,update on mlc2_private.records to authenticated;
grant select,insert on mlc2_private.receipts to authenticated;

create policy "mlc2_records_own_select" on mlc2_private.records
 for select to authenticated using ((select auth.uid())=user_id);
create policy "mlc2_records_own_insert" on mlc2_private.records
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "mlc2_records_own_update" on mlc2_private.records
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy "mlc2_receipts_own_select" on mlc2_private.receipts
 for select to authenticated using ((select auth.uid())=user_id);
create policy "mlc2_receipts_own_insert" on mlc2_private.receipts
 for insert to authenticated with check ((select auth.uid())=user_id);

-- Function is SECURITY INVOKER. No service-role credential is in the browser.
-- PostgREST exposes public RPC while underlying tables remain in a private schema.
create or replace function public.mlc2_v1_commit(
 p_op_id uuid, p_type text, p_record_id text, p_base_revision bigint,
 p_deleted boolean, p_payload jsonb
) returns jsonb
language plpgsql volatile security invoker
set search_path=''
as $$
declare
 v_owner uuid := (select auth.uid());
 v_previous bigint;
 v_revision bigint;
 v_receipt mlc2_private.receipts%rowtype;
 v_hash text;
begin
 if v_owner is null then raise exception 'verified user required' using errcode='42501'; end if;
 if p_type not in ('session','custom-plan','tracking','measurement','meal','goal')
    or length(p_record_id) not between 1 and 160 or p_op_id is null
    or p_base_revision is null or p_base_revision < 0
    or p_deleted is null or (not p_deleted and (p_payload is null or jsonb_typeof(p_payload) <> 'object'))
 then raise exception 'invalid operation' using errcode='22023'; end if;

 v_hash := md5(p_type||':'||p_record_id||':'||p_base_revision::text||':'||p_deleted::text||':'||coalesce(p_payload::text,'null'));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   v_owner::text||':'||p_type||':'||p_record_id,0));

 select * into v_receipt from mlc2_private.receipts
 where user_id=v_owner and op_id=p_op_id;
 if found then
   if v_receipt.request_hash<>v_hash then raise exception 'operation id reused with different payload' using errcode='22023'; end if;
   return jsonb_build_object('owner',v_owner,'opId',p_op_id,'revision',v_receipt.revision,'replayed',true);
 end if;

 select revision into v_previous from mlc2_private.records
 where user_id=v_owner and record_type=p_type and record_id=p_record_id for update;
 if coalesce(v_previous,0)<>p_base_revision then
   raise exception 'MLC2_REVISION_CONFLICT' using errcode='PT409';
 end if;
 if p_deleted and v_previous is null then raise exception 'cannot delete nonexistent record' using errcode='22023'; end if;
 v_revision:=p_base_revision+1;
 insert into mlc2_private.records(user_id,record_type,record_id,revision,payload,deleted_at,updated_at)
 values(v_owner,p_type,p_record_id,v_revision,case when p_deleted then '{}'::jsonb else p_payload end,
   case when p_deleted then now() else null end,now())
 on conflict(user_id,record_type,record_id) do update
 set revision=excluded.revision,payload=excluded.payload,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at;
 insert into mlc2_private.receipts(user_id,op_id,record_type,record_id,request_hash,revision)
 values(v_owner,p_op_id,p_type,p_record_id,v_hash,v_revision);
 return jsonb_build_object('owner',v_owner,'opId',p_op_id,'revision',v_revision,'replayed',false);
end;$$;
-- Explicit owner-scoped read-only RPC for controlled recovery previews.
create or replace function public.mlc2_v1_read(p_type text,p_record_id text)
returns jsonb language plpgsql stable security invoker set search_path=''
as $
declare
 v_owner uuid := (select auth.uid());
 v_record mlc2_private.records%rowtype;
begin
 if v_owner is null then raise exception 'verified user required' using errcode='42501'; end if;
 if p_type not in ('session','custom-plan','tracking','measurement','meal','goal')
 or p_record_id is null or length(p_record_id) not between 1 and 160
 then raise exception 'invalid record' using errcode='22023'; end if;
 select * into v_record from mlc2_private.records
 where user_id=v_owner and record_type=p_type and record_id=p_record_id;
 if not found then return null; end if;
 return jsonb_build_object('owner',v_owner,'type',v_record.record_type,
  'id',v_record.record_id,'revision',v_record.revision,
  'deleted',v_record.deleted_at is not null,'payload',v_record.payload);
end;$;
revoke all on function public.mlc2_v1_read(text,text) from public, anon;
grant execute on function public.mlc2_v1_read(text,text) to authenticated;

revoke all on function public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb) from public, anon;
grant execute on function public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb) to authenticated;
commit;

-- REQUIREMENTS before deployment:
-- 1. RLS test A and B with actual JWTs, plus anonymous request denied.
-- 2. Verify mlc2_private is not exposed by PostgREST; no direct REST table access.
-- 3. Test same op id replay, changed payload replay denied, stale revision 409,
--    atomic receipt/record update, read-after-write, tombstone/restore policy.
-- 4. Implement read-only collection/pagination RPC before enabling downloads.
-- 5. Review error-code mappings in the deployed PostgREST version.
