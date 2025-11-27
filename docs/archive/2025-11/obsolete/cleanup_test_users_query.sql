-- ============================================================================
-- TEST USER DATA DISCOVERY SCRIPT
-- Target users: kyle@bushelsenergy.com, kyle@ibelievefit.com
-- ============================================================================
-- This script queries all tables to identify data associated with test users
-- Run this in Supabase SQL Editor to generate a comprehensive report
-- ============================================================================

-- Step 1: Find user IDs from auth.users
WITH test_users AS (
  SELECT id, email, raw_user_meta_data
  FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'AUTH USERS' as table_name,
  id,
  email,
  raw_user_meta_data,
  created_at,
  last_sign_in_at
FROM test_users;

-- Step 2: Find companies associated with these users
WITH test_users AS (
  SELECT id, email FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'COMPANIES' as table_name,
  c.id,
  c.name,
  c.domain,
  c.created_at,
  (SELECT COUNT(*) FROM storage_requests WHERE company_id = c.id) as storage_requests_count,
  (SELECT COUNT(*) FROM inventory WHERE company_id = c.id) as inventory_count
FROM companies c
WHERE c.domain IN (
  SELECT SUBSTRING(email FROM '@(.*)$') FROM test_users
)
OR c.id IN (
  SELECT (raw_user_meta_data->>'company_id')::uuid
  FROM test_users
  WHERE raw_user_meta_data->>'company_id' IS NOT NULL
);

-- Step 3: Find storage requests
WITH test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
  OR c.id IN (
    SELECT (raw_user_meta_data->>'company_id')::uuid
    FROM auth.users
    WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
    AND raw_user_meta_data->>'company_id' IS NOT NULL
  )
)
SELECT
  'STORAGE_REQUESTS' as table_name,
  sr.id,
  sr.company_id,
  sr.user_email,
  sr.reference_id,
  sr.status,
  sr.created_at,
  (SELECT COUNT(*) FROM trucking_loads WHERE storage_request_id = sr.id) as trucking_loads_count,
  (SELECT COUNT(*) FROM conversations WHERE request_id = sr.id) as conversations_count
FROM storage_requests sr
WHERE sr.company_id IN (SELECT company_id FROM test_companies)
   OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com');

-- Step 4: Find trucking loads
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'TRUCKING_LOADS' as table_name,
  tl.id,
  tl.storage_request_id,
  tl.direction,
  tl.sequence_number,
  tl.status,
  tl.total_joints_planned,
  tl.created_at,
  (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id = tl.id) as documents_count
FROM trucking_loads tl
WHERE tl.storage_request_id IN (SELECT id FROM test_requests);

-- Step 5: Find trucking documents
WITH test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  JOIN storage_requests sr ON tl.storage_request_id = sr.id
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'TRUCKING_DOCUMENTS' as table_name,
  td.id,
  td.trucking_load_id,
  td.document_type,
  td.file_name,
  td.storage_path,
  td.status,
  td.uploaded_at
FROM trucking_documents td
WHERE td.trucking_load_id IN (SELECT id FROM test_loads);

-- Step 6: Find inventory items
WITH test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  'INVENTORY' as table_name,
  i.id,
  i.company_id,
  i.reference_id,
  i.type,
  i.quantity,
  i.status,
  i.delivery_truck_load_id,
  i.pickup_truck_load_id,
  i.storage_area_id,
  i.created_at
FROM inventory i
WHERE i.company_id IN (SELECT company_id FROM test_companies);

-- Step 7: Find conversations
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'CONVERSATIONS' as table_name,
  conv.id,
  conv.user_email,
  conv.company_id,
  conv.request_id,
  conv.conversation_type,
  conv.is_completed,
  conv.started_at,
  jsonb_array_length(conv.messages) as message_count
FROM conversations conv
WHERE conv.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
   OR conv.request_id IN (SELECT id FROM test_requests);

-- Step 8: Find documents
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'DOCUMENTS' as table_name,
  d.id,
  d.company_id,
  d.request_id,
  d.file_name,
  d.storage_path,
  d.is_processed,
  d.uploaded_at
FROM documents d
WHERE d.request_id IN (SELECT id FROM test_requests)
   OR d.company_id IN (
     SELECT c.id FROM companies c
     WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
   );

-- Step 9: Check for any sessions
SELECT
  'AUTH SESSIONS' as table_name,
  s.id,
  s.user_id,
  s.created_at,
  s.updated_at
FROM auth.sessions s
WHERE s.user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
);

-- Step 10: Summary counts
WITH test_users AS (
  SELECT id FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  WHERE tl.storage_request_id IN (SELECT id FROM test_requests)
)
SELECT
  'SUMMARY' as section,
  (SELECT COUNT(*) FROM test_users) as auth_users,
  (SELECT COUNT(*) FROM test_companies) as companies,
  (SELECT COUNT(*) FROM test_requests) as storage_requests,
  (SELECT COUNT(*) FROM test_loads) as trucking_loads,
  (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id IN (SELECT id FROM test_loads)) as trucking_documents,
  (SELECT COUNT(*) FROM inventory WHERE company_id IN (SELECT id FROM test_companies)) as inventory_items,
  (SELECT COUNT(*) FROM conversations WHERE user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as conversations,
  (SELECT COUNT(*) FROM documents WHERE request_id IN (SELECT id FROM test_requests)) as documents,
  (SELECT COUNT(*) FROM auth.sessions WHERE user_id IN (SELECT id FROM test_users)) as auth_sessions;
