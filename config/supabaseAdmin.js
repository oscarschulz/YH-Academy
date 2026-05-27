const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.YHU_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.YHU_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing YHU_SUPABASE_URL in environment.');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing YHU_SUPABASE_SERVICE_ROLE_KEY in environment.');
}

const yhuSupabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: WebSocket
    },
});

module.exports = {
  yhuSupabaseAdmin,
};
