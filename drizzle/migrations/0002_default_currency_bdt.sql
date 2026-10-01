alter table public.sip_providers alter column currency set default 'BDT';
alter table public.calls alter column currency set default 'BDT';
alter table public.organizations alter column base_currency set default 'BDT';