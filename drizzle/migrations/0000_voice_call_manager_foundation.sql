-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','admin','manager','viewer');
create type public.call_direction as enum ('inbound','outbound','internal','unknown');
create type public.call_status as enum ('answered','missed','failed','busy','no_answer','congestion','unknown');
create type public.correlation_status as enum ('matched','pending','unmatched','manually_matched');
create type public.sync_status as enum ('pending','running','completed','failed');
create type public.message_role as enum ('user','assistant','system','tool');

-- ============ CORE ORG TABLES ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  base_currency text not null default 'USD',
  usd_to_bdt numeric(12,4) not null default 120.0000,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index on public.organization_members (user_id);

-- ============ HELPERS ============
create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = _org and m.user_id = _user)
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = _org and m.user_id = _user and m.role = any(_roles))
$$;

-- ============ TELEPHONY / PROVIDERS ============
create table public.asterisk_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  asterisk_host text,
  ami_host text, ami_port integer default 5038, ami_username text,
  cdr_db_host text, cdr_db_port integer default 5432, cdr_db_name text, cdr_db_user text,
  recording_path text,
  enabled boolean not null default true,
  connection_status text not null default 'unknown',
  last_error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider_type text not null default 'elevenlabs',
  enabled boolean not null default true,
  connection_status text not null default 'unknown',
  last_error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_provider_id uuid references public.ai_providers(id) on delete set null,
  external_agent_id text not null,
  name text not null,
  enabled boolean not null default true,
  cost_per_minute numeric(12,6),
  created_at timestamptz not null default now(),
  unique (organization_id, external_agent_id)
);

create table public.sip_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider_type text,
  sip_username text,
  sip_host text,
  currency text not null default 'USD',
  incoming_rate numeric(12,6) not null default 0,
  outgoing_rate numeric(12,6) not null default 0,
  billing_increment integer not null default 60,
  minimum_duration integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sip_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sip_provider_id uuid references public.sip_providers(id) on delete set null,
  asterisk_instance_id uuid references public.asterisk_instances(id) on delete set null,
  ai_agent_id uuid references public.ai_agents(id) on delete set null,
  number text not null,
  label text,
  direction public.call_direction not null default 'inbound',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);

-- ============ SECRET CREDENTIALS (server-only) ============
create table public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  key_name text not null,
  secret_value text not null,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id, key_name)
);

-- ============ CALLS ============
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asterisk_instance_id uuid references public.asterisk_instances(id) on delete set null,
  ai_agent_id uuid references public.ai_agents(id) on delete set null,
  sip_number_id uuid references public.sip_numbers(id) on delete set null,
  sip_provider_id uuid references public.sip_providers(id) on delete set null,

  asterisk_uniqueid text,
  asterisk_linkedid text,
  conversation_id text,
  external_agent_id text,

  caller_number text,
  destination_number text,
  direction public.call_direction not null default 'unknown',
  status public.call_status not null default 'unknown',
  disposition text,

  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_secs integer not null default 0,
  billable_secs integer not null default 0,

  call_successful boolean,
  correlation_status public.correlation_status not null default 'pending',
  correlation_confidence numeric(5,2),

  provider_reported_cost numeric(14,6),
  ai_cost numeric(14,6) not null default 0,
  sip_cost numeric(14,6) not null default 0,
  total_cost numeric(14,6) not null default 0,
  currency text not null default 'USD',
  exchange_rate numeric(12,4),

  created_at timestamptz not null default now()
);

create unique index calls_conversation_unique on public.calls (organization_id, conversation_id) where conversation_id is not null;
create unique index calls_uniqueid_unique on public.calls (organization_id, asterisk_uniqueid) where asterisk_uniqueid is not null;
create index calls_org_started_idx on public.calls (organization_id, started_at desc);
create index calls_caller_idx on public.calls (organization_id, caller_number);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.message_role not null,
  message text not null,
  sequence integer not null default 0,
  spoken_at timestamptz
);
create index call_transcripts_call_idx on public.call_transcripts (call_id, sequence);

create table public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  summary_title text,
  transcript_summary text,
  call_successful boolean,
  customer_intent text,
  call_outcome text,
  next_action text,
  created_at timestamptz not null default now()
);

create table public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  recording_url text,
  duration_secs integer,
  format text,
  created_at timestamptz not null default now()
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_type text not null,
  status public.sync_status not null default 'pending',
  records_processed integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sync_jobs_org_idx on public.sync_jobs (organization_id, started_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source text not null,
  external_id text,
  payload jsonb not null,
  processed boolean not null default false,
  error_message text,
  received_at timestamptz not null default now(),
  unique (source, external_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

-- ============ GRANTS ============
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.asterisk_instances to authenticated;
grant select, insert, update, delete on public.ai_providers to authenticated;
grant select, insert, update, delete on public.ai_agents to authenticated;
grant select, insert, update, delete on public.sip_providers to authenticated;
grant select, insert, update, delete on public.sip_numbers to authenticated;
grant select on public.calls to authenticated;
grant select on public.call_transcripts to authenticated;
grant select on public.call_summaries to authenticated;
grant select on public.call_recordings to authenticated;
grant select on public.sync_jobs to authenticated;
grant select on public.audit_logs to authenticated;

grant all on public.organizations to service_role;
grant all on public.profiles to service_role;
grant all on public.organization_members to service_role;
grant all on public.asterisk_instances to service_role;
grant all on public.ai_providers to service_role;
grant all on public.ai_agents to service_role;
grant all on public.sip_providers to service_role;
grant all on public.sip_numbers to service_role;
grant all on public.api_credentials to service_role;
grant all on public.calls to service_role;
grant all on public.call_transcripts to service_role;
grant all on public.call_summaries to service_role;
grant all on public.call_recordings to service_role;
grant all on public.sync_jobs to service_role;
grant all on public.webhook_events to service_role;
grant all on public.audit_logs to service_role;

-- ============ RLS ============
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.asterisk_instances enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_agents enable row level security;
alter table public.sip_providers enable row level security;
alter table public.sip_numbers enable row level security;
alter table public.api_credentials enable row level security;
alter table public.calls enable row level security;
alter table public.call_transcripts enable row level security;
alter table public.call_summaries enable row level security;
alter table public.call_recordings enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile write" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id, auth.uid()));
create policy "anyone create org" on public.organizations for insert to authenticated with check (true);
create policy "admins update org" on public.organizations for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['super_admin','admin']::public.app_role[]));

create policy "members read memberships" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id, auth.uid()));
create policy "self or admin insert membership" on public.organization_members for insert to authenticated
  with check (user_id = auth.uid() or public.has_org_role(organization_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "admins update membership" on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "admins delete membership" on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['super_admin','admin']::public.app_role[]));

-- config tables: members read, admins/managers write
do $$
declare t text;
begin
  foreach t in array array['asterisk_instances','ai_providers','ai_agents','sip_providers','sip_numbers'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_org_member(organization_id, auth.uid()))', t);
    execute format('create policy "admins insert" on public.%I for insert to authenticated with check (public.has_org_role(organization_id, auth.uid(), array[''super_admin'',''admin'']::public.app_role[]))', t);
    execute format('create policy "admins update" on public.%I for update to authenticated using (public.has_org_role(organization_id, auth.uid(), array[''super_admin'',''admin'']::public.app_role[]))', t);
    execute format('create policy "admins delete" on public.%I for delete to authenticated using (public.has_org_role(organization_id, auth.uid(), array[''super_admin'',''admin'']::public.app_role[]))', t);
  end loop;
  foreach t in array array['calls','call_transcripts','call_summaries','call_recordings','sync_jobs','audit_logs'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_org_member(organization_id, auth.uid()))', t);
  end loop;
end $$;

-- api_credentials & webhook_events: no authenticated policies at all (service_role only)

-- ============ PROFILE TRIGGER ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
