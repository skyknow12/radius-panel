-- =============================================================================
--  RADIUS PRO — Migration 002: Realistic Demo Data for Phase 1
--  Populates NAS devices, demo RADIUS subscribers, accounting sessions,
--  and recent authentication logs so the NOC dashboard looks alive out-of-the-box.
-- =============================================================================

-- 1. NAS Devices
INSERT INTO nas_devices (name, ip_address, nas_type, vendor, model, location, status, last_seen_at) VALUES
  ('FW-BNG-01', '100.111.20.1', 'cisco', 'Cisco', 'ASR 9000', 'Kathmandu Core DC-1', 'online', NOW() - INTERVAL '2 minutes'),
  ('FW-BNG-02', '100.111.21.1', 'cisco', 'Cisco', 'ASR 9000', 'Kathmandu Core DC-2', 'online', NOW() - INTERVAL '3 minutes'),
  ('KTM-BNG',    '100.111.30.1', 'juniper', 'Juniper', 'MX480', 'Kathmandu Aggregation', 'online', NOW() - INTERVAL '5 minutes'),
  ('Dharan-BNG', '100.111.40.1', 'mikrotik', 'MikroTik', 'CCR2004', 'Dharan POP', 'warning', NOW() - INTERVAL '18 minutes'),
  ('Pokhara-BNG','100.111.50.1', 'mikrotik', 'MikroTik', 'CCR2116', 'Pokhara West POP', 'online', NOW() - INTERVAL '1 minute'),
  ('Birgunj-BNG','100.111.60.1', 'huawei', 'Huawei', 'NE40E', 'Birgunj Border POP', 'online', NOW() - INTERVAL '4 minutes')
ON CONFLICT (name) DO NOTHING;

-- 2. FreeRADIUS nas table
INSERT INTO nas (nasname, shortname, type, ports, secret, description) VALUES
  ('100.111.20.1', 'FW-BNG-01', 'cisco', 1812, 'testing123', 'Kathmandu Core DC-1'),
  ('100.111.21.1', 'FW-BNG-02', 'cisco', 1812, 'testing123', 'Kathmandu Core DC-2'),
  ('100.111.30.1', 'KTM-BNG', 'juniper', 1812, 'testing123', 'Kathmandu Aggregation'),
  ('100.111.40.1', 'Dharan-BNG', 'mikrotik', 1812, 'testing123', 'Dharan POP')
ON CONFLICT DO NOTHING;

-- 3. Initial Active Accounting Sessions (radacct) for Online Users widget
INSERT INTO radacct (
  AcctSessionId, AcctUniqueId, UserName, NASIPAddress, NASPortId, NASPortType,
  AcctStartTime, AcctUpdateTime, AcctSessionTime,
  AcctInputOctets, AcctOutputOctets,
  FramedIPAddress, CallingStationId
) VALUES
  ('sess-1001', 'uniq-1001', 'aakash001', '100.111.20.1', 'eth0/1/1', 'Ethernet',
   NOW() - INTERVAL '2 hours 34 minutes 21 seconds', NOW(), 9261,
   45205569536, 133570494464, '100.111.20.21', 'A4:83:E7:22:90:1A'),
  ('sess-1002', 'uniq-1002', 'user10021', '100.111.20.1', 'eth0/1/2', 'Ethernet',
   NOW() - INTERVAL '5 hours 12 minutes', NOW(), 18720,
   12450000000, 38900000000, '100.111.21.45', 'D8:5E:D3:44:11:8B'),
  ('sess-1003', 'uniq-1003', 'user18442', '100.111.21.1', 'eth0/2/1', 'Ethernet',
   NOW() - INTERVAL '1 hour 45 minutes', NOW(), 6300,
   8200000000, 24100000000, '100.111.45.12', '3C:52:82:77:AA:02'),
  ('sess-1004', 'uniq-1004', 'sharma_sub', '100.111.30.1', 'sfp-sfpplus1', 'Async',
   NOW() - INTERVAL '8 hours 19 minutes', NOW(), 29940,
   61200000000, 185000000000, '100.111.30.105', 'F0:9F:C2:10:E4:55'),
  ('sess-1005', 'uniq-1005', 'fiber_corp_09', '100.111.20.1', 'eth0/3/1', 'Ethernet',
   NOW() - INTERVAL '14 hours 2 minutes', NOW(), 50520,
   245000000000, 780000000000, '100.111.20.88', 'E0:D5:5E:99:32:01'),
  ('sess-1006', 'uniq-1006', 'isp_home_882', '100.111.40.1', 'ether2', 'Wireless',
   NOW() - INTERVAL '44 minutes', NOW(), 2640,
   3100000000, 9400000000, '100.111.40.54', '00:1A:2B:3C:4D:5E')
ON CONFLICT (AcctUniqueId) DO NOTHING;

-- 4. Sample PostAuth logs (radpostauth)
INSERT INTO radpostauth (username, reply, authdate, CalledStationId, CallingStationId) VALUES
  ('user10021', 'Access-Accept', NOW() - INTERVAL '42 seconds', 'FW-BNG-01', '100.111.21.45'),
  ('user18442', 'Access-Accept', NOW() - INTERVAL '83 seconds', 'FW-BNG-02', '100.111.45.12'),
  ('testuser', 'Access-Reject', NOW() - INTERVAL '196 seconds', 'FW-BNG-01', '100.111.20.1'),
  ('aakash001', 'Access-Accept', NOW() - INTERVAL '5 minutes', 'FW-BNG-01', '100.111.20.21'),
  ('unknown_pppoe', 'Access-Reject', NOW() - INTERVAL '8 minutes', 'Dharan-BNG', '100.111.40.99'),
  ('fiber_corp_09', 'Access-Accept', NOW() - INTERVAL '12 minutes', 'FW-BNG-01', '100.111.20.88');
