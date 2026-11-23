-- Read-only RPC bodies captured from production, installed only in the local fixture.
CREATE OR REPLACE FUNCTION public.mlc2_v1_list_sessions(p_after_id text DEFAULT ''::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_user uuid := (select auth.uid()); v_items jsonb;
begin
 if v_user is null then raise exception 'Account verification required' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_id is null or length(p_after_id)>160
 then raise exception 'Invalid page cursor or size' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('owner',user_id,'type',record_type,'id',record_id,
 'revision',revision,'payload',payload,'deleted',deleted_at is not null) order by record_id),'[]'::jsonb)
 into v_items from (select user_id,record_type,record_id,revision,payload,deleted_at
 from mlc2_private.records
 where user_id=v_user and record_type='session' and record_id>p_after_id
 order by record_id limit p_limit) result;
 return v_items;
end;$function$;

CREATE OR REPLACE FUNCTION public.mlc2_v1_read(p_type text, p_record_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 v_owner uuid := (select auth.uid());
 v_record mlc2_private.records%rowtype;
begin
 if v_owner is null then raise exception 'verified user required' using errcode='42501'; end if;
 if p_type is null or p_type not in ('session','custom-plan','tracking','measurement','meal','goal')
 or p_record_id is null or length(p_record_id) not between 1 and 160
 then raise exception 'invalid record' using errcode='22023'; end if;
 select * into v_record from mlc2_private.records
 where user_id=v_owner and record_type=p_type and record_id=p_record_id;
 if not found then return null; end if;
 return jsonb_build_object('owner',v_owner,'type',v_record.record_type,
  'id',v_record.record_id,'revision',v_record.revision,
  'deleted',v_record.deleted_at is not null,'payload',v_record.payload);
end;$function$;

revoke execute on function public.mlc2_v1_read(text,text), public.mlc2_v1_list_sessions(text,integer) from public, anon;
grant execute on function public.mlc2_v1_read(text,text), public.mlc2_v1_list_sessions(text,integer) to authenticated;
