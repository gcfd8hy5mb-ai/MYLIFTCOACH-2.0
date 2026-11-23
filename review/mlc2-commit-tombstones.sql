-- Reviewed forward migration for project kirlpjflaoriiusfamsk. Apply only with separate authorization.
-- This preserves the installed function's signature, execution grants and caller RLS.
-- The receipt check precedes the deleted-record check so a retry never changes the record.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- CREATE OR REPLACE must target the deployed function and preserve its ACL.
do $guard$
declare
 target regprocedure := to_regprocedure('public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb)');
begin
 if target is null then raise exception 'Expected 2.0 commit RPC is missing'; end if;
 if has_function_privilege('anon',target,'EXECUTE') or
    not has_function_privilege('authenticated',target,'EXECUTE') or
    (select prosecdef from pg_proc where oid=target) then
  raise exception 'Unexpected 2.0 commit RPC grants or execution mode';
 end if;
 if encode(sha256(convert_to(pg_get_functiondef(target),'UTF8')),'hex')
    is distinct from '43410a29b5a326729d33f3fb5ae8dff7473948aba478cd02383ebf752fa81ebf' then
  raise exception '2.0 commit RPC definition differs from the reviewed baseline';
 end if;
end
$guard$;

CREATE OR REPLACE FUNCTION public.mlc2_v1_commit(p_op_id uuid, p_type text, p_record_id text, p_base_revision bigint, p_deleted boolean, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
 v_owner uuid := (select auth.uid());
 v_previous bigint;
 v_revision bigint;
 v_deleted boolean;
 v_receipt mlc2_private.receipts%rowtype;
 v_hash text;
begin
 if v_owner is null then raise exception 'verified user required' using errcode='42501'; end if;
 if p_type is null or p_type not in ('session','custom-plan','tracking','measurement','meal','goal')
    or p_record_id is null or length(p_record_id) not between 1 and 160 or p_op_id is null
    or p_base_revision is null or p_base_revision < 0
    or p_deleted is null or (not p_deleted and (p_payload is null or jsonb_typeof(p_payload) <> 'object'))
    or (p_payload is not null and length(p_payload::text)>100000)
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

 select revision, deleted_at is not null into v_previous, v_deleted from mlc2_private.records
 where user_id=v_owner and record_type=p_type and record_id=p_record_id for update;
 if coalesce(v_previous,0)<>p_base_revision or coalesce(v_deleted,false) then
   raise exception 'MLC2_REVISION_CONFLICT' using errcode='PT409';
 end if;
 if p_deleted and v_previous is null then raise exception 'cannot delete nonexistent record' using errcode='22023'; end if;
 v_revision:=p_base_revision+1;
 insert into mlc2_private.records as target(user_id,record_type,record_id,revision,payload,deleted_at,updated_at)
 values(v_owner,p_type,p_record_id,v_revision,case when p_deleted then '{}'::jsonb else p_payload end,
   case when p_deleted then now() else null end,now())
 on conflict(user_id,record_type,record_id) do update
 set revision=excluded.revision,payload=excluded.payload,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at
 where target.revision=p_base_revision and target.deleted_at is null;
 if not found then raise exception 'MLC2_REVISION_CONFLICT' using errcode='PT409'; end if;
 insert into mlc2_private.receipts(user_id,op_id,record_type,record_id,request_hash,revision)
 values(v_owner,p_op_id,p_type,p_record_id,v_hash,v_revision);
 return jsonb_build_object('owner',v_owner,'opId',p_op_id,'revision',v_revision,'replayed',false);
end;$function$;

commit;
