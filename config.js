/*
  DOPLŇ TOTO PRED NASADENÍM.

  V Supabase Dashboard nájdeš Project URL a Publishable key
  v Connect / API Keys.

  Publishable key môže byť v klientskom JavaScripte, ak máš správne
  nastavené Row Level Security (RLS). NIKDY sem nedávaj service_role/secret key.
*/
npm install @supabase/supabase-js
window.CMRP_CONFIG = {
  SUPABASE_URL: "https://gugqqskpctxjxhuewmsq.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_QDnX6zc3Nre8GG6XM6rJzA_UGusQ_dW"
};
