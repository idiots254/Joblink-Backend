const { createClient } = require('@supabase/supabase-js');

let _adminClient = null;

function getAdminClient() {
  if (_adminClient) return _adminClient;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://cvsifkizrofmorvfmwmq.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    // server-side defaults: keep auth refresh disabled and avoid browser storage
    auth: { persistSession: false },
  });
  return _adminClient;
}

module.exports = { getAdminClient };
