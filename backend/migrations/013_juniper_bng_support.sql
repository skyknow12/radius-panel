-- =============================================================================
--  RADIUS PRO — Migration 013: Juniper BNG RADIUS & Dynamic Profile Support
--
--  1. Extend nas_devices for multi-vendor support (Juniper, MikroTik, Generic)
--  2. Extend packages & package_attributes for vendor-specific profiles
--  3. Extend radacct with gigaword counters (AcctInputGigawords / AcctOutputGigawords)
--  4. Verified RADIUS attribute catalog table seeded with official Juniper VSAs
-- =============================================================================

-- 1. Extend nas_devices
ALTER TABLE nas_devices
  ADD COLUMN IF NOT EXISTS os_version VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS dynamic_profile_name VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS coa_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Normalize vendor column on nas_devices
DO $$
BEGIN
  -- If vendor is NULL, infer from nas_type
  UPDATE nas_devices
     SET vendor = CASE
       WHEN nas_type ILIKE '%juniper%' THEN 'juniper'
       WHEN nas_type ILIKE '%cisco%' THEN 'cisco'
       WHEN nas_type ILIKE '%huawei%' THEN 'huawei'
       WHEN nas_type ILIKE '%mikrotik%' THEN 'mikrotik'
       ELSE 'generic'
     END
   WHERE vendor IS NULL OR vendor = '';
END $$;

-- 2. Extend packages for Juniper BNG Dynamic Profiles
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS juniper_ingress_policy VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS juniper_egress_policy VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS juniper_activate_service VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS juniper_cos_shaping_rate VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS juniper_dynamic_profile VARCHAR(64) NULL;

-- Extend package_attributes with vendor tag
ALTER TABLE package_attributes
  ADD COLUMN IF NOT EXISTS vendor VARCHAR(32) NOT NULL DEFAULT 'generic';

-- Populate vendor on existing package attributes
UPDATE package_attributes
   SET vendor = 'mikrotik'
 WHERE attribute ILIKE 'Mikrotik-%' AND vendor = 'generic';

UPDATE package_attributes
   SET vendor = 'juniper'
 WHERE attribute ILIKE 'Juniper-%' AND vendor = 'generic';

-- 3. Extend radacct with gigawords for 64-bit counter rollover prevention
ALTER TABLE radacct
  ADD COLUMN IF NOT EXISTS AcctInputGigawords BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS AcctOutputGigawords BIGINT DEFAULT 0;

-- 4. RADIUS Attribute Catalog
CREATE TABLE IF NOT EXISTS radius_attribute_catalog (
  id                     SERIAL PRIMARY KEY,
  vendor                 VARCHAR(32) NOT NULL,            -- 'juniper', 'mikrotik', 'rfc', 'generic'
  vendor_id              INTEGER NULL,                   -- 2636 (Juniper), 14988 (MikroTik), NULL (RFC)
  attribute_code         INTEGER NOT NULL,
  attribute_name         VARCHAR(96) NOT NULL UNIQUE,
  data_type              VARCHAR(32) NOT NULL,            -- 'string', 'integer', 'ipaddr', 'ipv6addr', 'ipv6prefix'
  has_tag                BOOLEAN NOT NULL DEFAULT FALSE,
  coa_supported          BOOLEAN NOT NULL DEFAULT FALSE,
  dynamic_profile_var    VARCHAR(64) NULL,               -- e.g. '$junos-input-filter'
  description            TEXT NULL,
  default_op             VARCHAR(4) NOT NULL DEFAULT ':=',
  sample_value           VARCHAR(128) NULL,
  is_common              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radius_attr_catalog_vendor ON radius_attribute_catalog(vendor);
CREATE INDEX IF NOT EXISTS idx_radius_attr_catalog_name ON radius_attribute_catalog(attribute_name);

-- Seed Verified Juniper BNG VSAs (Vendor ID 2636)
INSERT INTO radius_attribute_catalog
  (vendor, vendor_id, attribute_code, attribute_name, data_type, coa_supported, dynamic_profile_var, description, sample_value, is_common)
VALUES
  ('juniper', 2636, 1, 'Juniper-Virtual-Router', 'string', false, '$junos-routing-instance', 'Specifies the routing instance / VRF for the subscriber session', 'default', true),
  ('juniper', 2636, 2, 'Juniper-Default-IPv4-Address', 'ipaddr', false, '$junos-framed-ip-address', 'Default IPv4 address assigned to the subscriber session', '10.10.1.100', false),
  ('juniper', 2636, 3, 'Juniper-Default-IPv6-Address', 'ipv6addr', false, '$junos-framed-ipv6-address', 'Default IPv6 address assigned to the subscriber session', '2001:db8::10', false),
  ('juniper', 2636, 4, 'Juniper-Primary-Dns', 'ipaddr', false, NULL, 'Primary IPv4 DNS server IP returned to subscriber CPE', '8.8.8.8', true),
  ('juniper', 2636, 5, 'Juniper-Secondary-Dns', 'ipaddr', false, NULL, 'Secondary IPv4 DNS server IP returned to subscriber CPE', '1.1.1.1', true),
  ('juniper', 2636, 8, 'Juniper-Radius-Profile', 'string', false, NULL, 'Specifies the radius profile name for subscriber', 'SUB-PROFILE-1', false),
  ('juniper', 2636, 10, 'Juniper-Ingress-Policy-Name', 'string', true, '$junos-input-filter', 'Ingress firewall filter applied to subscriber interface for upstream rate-limiting/policing', '100M-IN', true),
  ('juniper', 2636, 11, 'Juniper-Egress-Policy-Name', 'string', true, '$junos-output-filter', 'Egress firewall filter applied to subscriber interface for downstream rate-limiting/shaping', '100M-OUT', true),
  ('juniper', 2636, 63, 'Juniper-Interface-Desc', 'string', false, '$junos-interface-description', 'Dynamic interface description rendered in Junos CLI', 'PPPoE Cust #1234', false),
  ('juniper', 2636, 65, 'Juniper-Activate-Service', 'string', true, '$junos-activate-service', 'Dynamic service activation name with optional arguments (e.g. SERVICE(param))', 'PREMIUM-COS(100M)', true),
  ('juniper', 2636, 66, 'Juniper-Deactivate-Service', 'string', true, NULL, 'Deactivates a previously activated dynamic service profile', 'PREMIUM-COS', false),
  ('juniper', 2636, 67, 'Juniper-Service-Volume', 'integer', false, NULL, 'Service volume quota in octets before service is deactivated or triggers notification', '10737418240', false),
  ('juniper', 2636, 68, 'Juniper-Service-Timeout', 'integer', false, NULL, 'Service duration timeout in seconds', '86400', false),
  ('juniper', 2636, 69, 'Juniper-Service-Statistics', 'integer', false, NULL, 'Dynamic service accounting collection: 1=time, 2=volume, 3=both', '3', false),
  ('juniper', 2636, 106, 'Juniper-IPv6-Ingress-Policy-Name', 'string', true, '$junos-input-ipv6-filter', 'IPv6 ingress firewall filter applied to subscriber interface', 'IPV6-100M-IN', true),
  ('juniper', 2636, 107, 'Juniper-IPv6-Egress-Policy-Name', 'string', true, '$junos-output-ipv6-filter', 'IPv6 egress firewall filter applied to subscriber interface', 'IPV6-100M-OUT', true),
  ('juniper', 2636, 108, 'Juniper-CoS-Parameter-Type', 'string', true, '$junos-cos-parameter-type', 'Class of Service parameter type identifier', 'COS-DEFAULT', false),
  ('juniper', 2636, 146, 'Juniper-CoS-Scheduler-Pmt-Type', 'string', true, NULL, 'CoS scheduler parameter type', 'SCHED-P1', false),
  ('juniper', 2636, 157, 'Juniper-Cos-Rewrite-Rules', 'string', true, NULL, 'CoS rewrite rules mapping profile name', 'REWRITE-DEFAULT', false),
  ('juniper', 2636, 161, 'Juniper-IPv6-Delegated-Pool-Name', 'string', false, NULL, 'Local IPv6 address/prefix pool name on Juniper BNG for DHCPv6-PD', 'POOL-IPV6-DELEGATED', true),
  ('juniper', 2636, 174, 'Juniper-Client-Profile-Name', 'string', false, '$junos-client-profile', 'Name of Junos Dynamic Profile used to instantiate the subscriber session', 'PPPOE-PROFILE', true),
  ('juniper', 2636, 177, 'Juniper-Cos-Shaping-Rate', 'string', true, '$junos-cos-shaping-rate', 'Subscriber CoS shaping rate limit (e.g. 100m, 50m)', '100m', true),
  ('juniper', 2636, 180, 'Juniper-Update-Service', 'string', true, NULL, 'Dynamically updates parameters of an active service profile', 'SERVICE(150M)', false),
  ('juniper', 2636, 191, 'Juniper-Input-Interface-Filter', 'string', true, '$junos-input-interface-filter', 'Dynamic interface-level input filter', 'INT-FILTER-IN', false),
  ('juniper', 2636, 192, 'Juniper-Output-Interface-Filter', 'string', true, '$junos-output-interface-filter', 'Dynamic interface-level output filter', 'INT-FILTER-OUT', false)
ON CONFLICT (attribute_name) DO NOTHING;

-- Seed Verified MikroTik VSAs (Vendor ID 14988)
INSERT INTO radius_attribute_catalog
  (vendor, vendor_id, attribute_code, attribute_name, data_type, coa_supported, dynamic_profile_var, description, sample_value, is_common)
VALUES
  ('mikrotik', 14988, 8, 'Mikrotik-Rate-Limit', 'string', true, NULL, 'MikroTik Rx/Tx bandwidth rate limit and burst string (Rx/Tx [Burst-Rx/Burst-Tx] ...)', '100M/100M', true),
  ('mikrotik', 14988, 19, 'Mikrotik-Address-List', 'string', true, NULL, 'Adds subscriber IP to MikroTik IP firewall address list', 'ACTIVE_SUBSCRIBERS', true),
  ('mikrotik', 14988, 3, 'Mikrotik-Group', 'string', false, NULL, 'Assigns subscriber to a specific RouterOS user group', 'read-only', false),
  ('mikrotik', 14988, 17, 'Mikrotik-Total-Limit', 'integer', false, NULL, 'Total octet limit allowed for subscriber session before disconnection', '10737418240', false)
ON CONFLICT (attribute_name) DO NOTHING;

-- Seed Standard RFC / IETF RADIUS Attributes
INSERT INTO radius_attribute_catalog
  (vendor, vendor_id, attribute_code, attribute_name, data_type, coa_supported, dynamic_profile_var, description, sample_value, is_common)
VALUES
  ('rfc', NULL, 6, 'Service-Type', 'integer', false, NULL, 'RFC 2865: Type of service subscriber requested (2=Framed)', '2', true),
  ('rfc', NULL, 7, 'Framed-Protocol', 'integer', false, NULL, 'RFC 2865: Framing protocol (1=PPP)', '1', true),
  ('rfc', NULL, 8, 'Framed-IP-Address', 'ipaddr', false, '$junos-framed-ip-address', 'RFC 2865: IPv4 address assigned to framed subscriber', '100.64.1.50', true),
  ('rfc', NULL, 9, 'Framed-IP-Netmask', 'ipaddr', false, NULL, 'RFC 2865: Netmask for subscriber connection', '255.255.255.255', false),
  ('rfc', NULL, 12, 'Framed-MTU', 'integer', false, NULL, 'RFC 2865: Maximum Transmission Unit for framed connection', '1492', true),
  ('rfc', NULL, 27, 'Session-Timeout', 'integer', true, NULL, 'RFC 2865: Maximum session duration in seconds before re-authentication', '86400', true),
  ('rfc', NULL, 28, 'Idle-Timeout', 'integer', true, NULL, 'RFC 2865: Maximum idle duration in seconds before disconnection', '1800', true),
  ('rfc', NULL, 85, 'Acct-Interim-Interval', 'integer', true, NULL, 'RFC 2869: Interim accounting update frequency in seconds', '300', true),
  ('rfc', NULL, 97, 'Framed-IPv6-Prefix', 'ipv6prefix', false, '$junos-framed-ipv6-prefix', 'RFC 3162: Framed IPv6 prefix assigned to subscriber WAN', '2001:db8:1::/64', true),
  ('rfc', NULL, 123, 'Delegated-IPv6-Prefix', 'ipv6prefix', false, '$junos-delegated-ipv6-prefix', 'RFC 4818: Delegated IPv6 prefix routed to subscriber LAN (DHCPv6-PD)', '2001:db8:1000::/56', true)
ON CONFLICT (attribute_name) DO NOTHING;
