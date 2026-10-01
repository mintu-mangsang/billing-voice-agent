create or replace function public.create_workspace(_name text, _slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.organizations(name, slug) values (_name, _slug) returning id into _id;
  insert into public.organization_members(organization_id, user_id, role) values (_id, auth.uid(), 'super_admin');
  return _id;
end $$;
revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;