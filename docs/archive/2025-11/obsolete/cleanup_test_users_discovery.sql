-- ============================================================================
-- TEST USER DATA DISCOVERY SCRIPT (COMPREHENSIVE)
-- Target users: kyle@bushelsenergy.com, kyle@ibelievefit.com
-- Database: PipeVault Production (cvevhvjxnklbbhtqzyvw.supabase.co)
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-18
-- ============================================================================
-- Purpose: Identify ALL data associated with test users before deletion
-- Tables covered: auth.users, auth.sessions, companies, storage_requests,
--                 trucking_loads, trucking_documents, inventory, conversations,
--                 documents, shipments, shipment_trucks, dock_appointments,
--                 shipment_documents, shipment_items, notifications, notification_queue
-- ============================================================================

-- Step 1: Find user IDs from auth.users
SELECT '========== AUTH USERS ==========' as section;
SELECT
  id,
  email,
  raw_user_meta_data->>'company_id' as company_id_from_meta,
  raw_user_meta_data->>'role' as role,
  created_at,
  last_sign_in_at,
  confirmed_at
FROM auth.users
WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
ORDER BY email;

-- Step 2: Find companies associated with these users
SELECT '========== COMPANIES ==========' as section;
WITH test_user_company_ids AS (
  SELECT DISTINCT (raw_user_meta_data->>'company_id')::uuid as company_id
  FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
    AND raw_user_meta_data->>'company_id' IS NOT NULL
)
SELECT
  c.id,
  c.name,
  c.domain,
  c.is_customer,
  c.is_archived,
  c.archived_at,
  c.deleted_at,
  c.created_at,
  (SELECT COUNT(*) FROM storage_requests WHERE company_id = c.id) as storage_requests_count,
  (SELECT COUNT(*) FROM inventory WHERE company_id = c.id) as inventory_count,
  (SELECT COUNT(*) FROM shipments WHERE company_id = c.id) as shipments_count
FROM companies c
WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
   OR c.id IN (SELECT company_id FROM test_user_company_ids)
ORDER BY c.created_at;

-- Step 3: Find storage requests
SELECT '========== STORAGE REQUESTS ==========' as section;
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
  sr.id,
  sr.company_id,
  sr.user_email,
  sr.reference_id,
  sr.status,
  sr.approved_at,
  sr.approved_by,
  sr.rejected_at,
  sr.archived_at,
  sr.created_at,
  (SELECT COUNT(*) FROM trucking_loads WHERE storage_request_id = sr.id) as trucking_loads_count,
  (SELECT COUNT(*) FROM conversations WHERE request_id = sr.id) as conversations_count,
  (SELECT COUNT(*) FROM shipments WHERE request_id = sr.id) as shipments_count
FROM storage_requests sr
WHERE sr.company_id IN (SELECT company_id FROM test_companies)
   OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
ORDER BY sr.created_at;

-- Step 4: Find trucking loads
SELECT '========== TRUCKING LOADS ==========' as section;
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  tl.id,
  tl.storage_request_id,
  tl.direction,
  tl.sequence_number,
  tl.status,
  tl.trucking_company,
  tl.total_joints_planned,
  tl.total_joints_completed,
  tl.approved_at,
  tl.completed_at,
  tl.created_at,
  (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id = tl.id) as documents_count,
  (SELECT COUNT(*) FROM inventory WHERE delivery_truck_load_id = tl.id) as inventory_delivery_count,
  (SELECT COUNT(*) FROM inventory WHERE pickup_truck_load_id = tl.id) as inventory_pickup_count
FROM trucking_loads tl
WHERE tl.storage_request_id IN (SELECT id FROM test_requests)
ORDER BY tl.created_at;

-- Step 5: Find trucking documents (WITH storage paths for file deletion)
SELECT '========== TRUCKING DOCUMENTS ==========' as section;
WITH test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  JOIN storage_requests sr ON tl.storage_request_id = sr.id
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  td.id,
  td.trucking_load_id,
  td.document_type,
  td.file_name,
  td.storage_path,
  td.status,
  td.uploaded_by,
  td.uploaded_at
FROM trucking_documents td
WHERE td.trucking_load_id IN (SELECT id FROM test_loads)
ORDER BY td.uploaded_at;

-- Step 6: Find inventory items
SELECT '========== INVENTORY ==========' as section;
WITH test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  i.id,
  i.company_id,
  i.reference_id,
  i.type,
  i.grade,
  i.outer_diameter,
  i.quantity,
  i.status,
  i.delivery_truck_load_id,
  i.pickup_truck_load_id,
  i.storage_area_id,
  i.drop_off_timestamp,
  i.pickup_timestamp,
  i.created_at
FROM inventory i
WHERE i.company_id IN (SELECT company_id FROM test_companies)
ORDER BY i.created_at;

-- Step 7: Find conversations
SELECT '========== CONVERSATIONS ==========' as section;
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  conv.id,
  conv.user_email,
  conv.company_id,
  conv.request_id,
  conv.conversation_type,
  conv.is_completed,
  conv.started_at,
  conv.completed_at,
  jsonb_array_length(conv.messages) as message_count
FROM conversations conv
WHERE conv.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
   OR conv.request_id IN (SELECT id FROM test_requests)
   OR conv.company_id IN (SELECT company_id FROM test_companies)
ORDER BY conv.started_at;

-- Step 8: Find documents (WITH storage paths for file deletion)
SELECT '========== DOCUMENTS ==========' as section;
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  d.id,
  d.company_id,
  d.request_id,
  d.inventory_id,
  d.file_name,
  d.file_type,
  d.file_size,
  d.storage_path,
  d.is_processed,
  d.uploaded_at,
  d.processed_at
FROM documents d
WHERE d.request_id IN (SELECT id FROM test_requests)
   OR d.company_id IN (SELECT company_id FROM test_companies)
ORDER BY d.uploaded_at;

-- Step 9: Find shipments
SELECT '========== SHIPMENTS ==========' as section;
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  s.id,
  s.request_id,
  s.company_id,
  s.created_by,
  s.status,
  s.trucking_method,
  s.trucking_company,
  s.number_of_trucks,
  s.estimated_joint_count,
  s.created_at,
  (SELECT COUNT(*) FROM shipment_trucks WHERE shipment_id = s.id) as trucks_count,
  (SELECT COUNT(*) FROM dock_appointments WHERE shipment_id = s.id) as appointments_count
FROM shipments s
WHERE s.request_id IN (SELECT id FROM test_requests)
   OR s.company_id IN (SELECT company_id FROM test_companies)
ORDER BY s.created_at;

-- Step 10: Find shipment trucks
SELECT '========== SHIPMENT TRUCKS ==========' as section;
WITH test_shipments AS (
  SELECT s.id
  FROM shipments s
  JOIN storage_requests sr ON s.request_id = sr.id
  JOIN companies c ON s.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  st.id,
  st.shipment_id,
  st.sequence_number,
  st.status,
  st.trucking_company,
  st.scheduled_slot_start,
  st.arrival_time,
  st.joints_count,
  st.created_at
FROM shipment_trucks st
WHERE st.shipment_id IN (SELECT id FROM test_shipments)
ORDER BY st.created_at;

-- Step 11: Find dock appointments
SELECT '========== DOCK APPOINTMENTS ==========' as section;
WITH test_shipments AS (
  SELECT s.id
  FROM shipments s
  JOIN storage_requests sr ON s.request_id = sr.id
  JOIN companies c ON s.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  da.id,
  da.shipment_id,
  da.truck_id,
  da.slot_start,
  da.slot_end,
  da.status,
  da.after_hours,
  da.surcharge_applied,
  da.created_at
FROM dock_appointments da
WHERE da.shipment_id IN (SELECT id FROM test_shipments)
ORDER BY da.slot_start;

-- Step 12: Find shipment documents
SELECT '========== SHIPMENT DOCUMENTS ==========' as section;
WITH test_shipments AS (
  SELECT s.id
  FROM shipments s
  JOIN storage_requests sr ON s.request_id = sr.id
  JOIN companies c ON s.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  sd.id,
  sd.shipment_id,
  sd.truck_id,
  sd.document_id,
  sd.document_type,
  sd.status,
  sd.uploaded_by,
  sd.created_at
FROM shipment_documents sd
WHERE sd.shipment_id IN (SELECT id FROM test_shipments)
ORDER BY sd.created_at;

-- Step 13: Find shipment items
SELECT '========== SHIPMENT ITEMS ==========' as section;
WITH test_shipments AS (
  SELECT s.id
  FROM shipments s
  JOIN storage_requests sr ON s.request_id = sr.id
  JOIN companies c ON s.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  si.id,
  si.shipment_id,
  si.truck_id,
  si.inventory_id,
  si.manufacturer,
  si.heat_number,
  si.quantity,
  si.status,
  si.created_at
FROM shipment_items si
WHERE si.shipment_id IN (SELECT id FROM test_shipments)
ORDER BY si.created_at;

-- Step 14: Find notifications
SELECT '========== NOTIFICATIONS ==========' as section;
WITH test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  n.id,
  n.user_id,
  n.company_id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
WHERE n.user_id IN (
    SELECT id FROM auth.users WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
  )
   OR n.company_id IN (SELECT company_id FROM test_companies)
ORDER BY n.created_at;

-- Step 15: Find notification queue entries
SELECT '========== NOTIFICATION QUEUE ==========' as section;
SELECT
  nq.id,
  nq.notification_type,
  nq.recipient_email,
  nq.payload,
  nq.status,
  nq.attempts,
  nq.last_error,
  nq.created_at,
  nq.processed_at
FROM notification_queue nq
WHERE nq.recipient_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
ORDER BY nq.created_at;

-- Step 16: Check for any sessions
SELECT '========== AUTH SESSIONS ==========' as section;
SELECT
  s.id,
  s.user_id,
  au.email,
  s.created_at,
  s.updated_at,
  s.not_after
FROM auth.sessions s
JOIN auth.users au ON s.user_id = au.id
WHERE s.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
ORDER BY s.created_at;

-- ============================================================================
-- SUMMARY COUNTS
-- ============================================================================
SELECT '========== SUMMARY COUNTS ==========' as section;
WITH test_users AS (
  SELECT id FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR c.id IN (
       SELECT (raw_user_meta_data->>'company_id')::uuid
       FROM auth.users
       WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
         AND raw_user_meta_data->>'company_id' IS NOT NULL
     )
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
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
SELECT
  (SELECT COUNT(*) FROM test_users) as auth_users,
  (SELECT COUNT(*) FROM auth.sessions WHERE user_id IN (SELECT id FROM test_users)) as auth_sessions,
  (SELECT COUNT(*) FROM test_companies) as companies,
  (SELECT COUNT(*) FROM test_requests) as storage_requests,
  (SELECT COUNT(*) FROM test_loads) as trucking_loads,
  (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id IN (SELECT id FROM test_loads)) as trucking_documents,
  (SELECT COUNT(*) FROM inventory WHERE company_id IN (SELECT id FROM test_companies)) as inventory_items,
  (SELECT COUNT(*) FROM conversations WHERE request_id IN (SELECT id FROM test_requests) OR user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as conversations,
  (SELECT COUNT(*) FROM documents WHERE request_id IN (SELECT id FROM test_requests) OR company_id IN (SELECT id FROM test_companies)) as documents,
  (SELECT COUNT(*) FROM test_shipments) as shipments,
  (SELECT COUNT(*) FROM shipment_trucks WHERE shipment_id IN (SELECT id FROM test_shipments)) as shipment_trucks,
  (SELECT COUNT(*) FROM dock_appointments WHERE shipment_id IN (SELECT id FROM test_shipments)) as dock_appointments,
  (SELECT COUNT(*) FROM shipment_documents WHERE shipment_id IN (SELECT id FROM test_shipments)) as shipment_documents,
  (SELECT COUNT(*) FROM shipment_items WHERE shipment_id IN (SELECT id FROM test_shipments)) as shipment_items,
  (SELECT COUNT(*) FROM notifications WHERE user_id IN (SELECT id FROM test_users)) as notifications,
  (SELECT COUNT(*) FROM notification_queue WHERE recipient_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as notification_queue_entries;

-- ============================================================================
-- STORAGE PATHS FOR FILE DELETION
-- ============================================================================
SELECT '========== FILES TO DELETE (Trucking Documents) ==========' as section;
WITH test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  JOIN storage_requests sr ON tl.storage_request_id = sr.id
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
SELECT
  'trucking_documents' as source_table,
  td.storage_path,
  td.file_name
FROM trucking_documents td
WHERE td.trucking_load_id IN (SELECT id FROM test_loads)
ORDER BY td.storage_path;

SELECT '========== FILES TO DELETE (Documents) ==========' as section;
WITH test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON sr.company_id = c.id
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id as company_id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
SELECT
  'documents' as source_table,
  d.storage_path,
  d.file_name
FROM documents d
WHERE d.request_id IN (SELECT id FROM test_requests)
   OR d.company_id IN (SELECT company_id FROM test_companies)
ORDER BY d.storage_path;

-- ============================================================================
-- END OF DISCOVERY SCRIPT
-- ============================================================================
