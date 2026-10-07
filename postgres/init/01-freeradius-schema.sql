-- =============================================================================
--  RADIUS PRO — 01: FreeRADIUS 3.2 PostgreSQL schema
--
--  Standard tables used by rlm_sql (dialect = postgresql). Column names follow
--  the upstream FreeRADIUS schema so the stock queries.conf works unchanged.
--  Runs automatically on the first start of an empty PostgreSQL volume.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  radacct — accounting sessions (Start / Interim-Update / Stop)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radacct (
	RadAcctId		bigserial PRIMARY KEY,
	AcctSessionId		text NOT NULL,
	AcctUniqueId		text NOT NULL UNIQUE,
	UserName		text,
	Realm			text,
	NASIPAddress		inet NOT NULL,
	NASPortId		text,
	NASPortType		text,
	AcctStartTime		timestamp with time zone,
	AcctUpdateTime		timestamp with time zone,
	AcctStopTime		timestamp with time zone,
	AcctInterval		bigint,
	AcctSessionTime		bigint,
	AcctAuthentic		text,
	ConnectInfo_start	text,
	ConnectInfo_stop	text,
	AcctInputOctets		bigint,
	AcctOutputOctets	bigint,
	CalledStationId		text,
	CallingStationId	text,
	AcctTerminateCause	text,
	ServiceType		text,
	FramedProtocol		text,
	FramedIPAddress		inet,
	FramedIPv6Address	inet,
	FramedIPv6Prefix	inet,
	FramedInterfaceId	text,
	DelegatedIPv6Prefix	inet,
	Class			text
);

-- For use by update-, stop- and simul_* queries
CREATE INDEX IF NOT EXISTS radacct_active_session_idx ON radacct (AcctUniqueId) WHERE AcctStopTime IS NULL;
-- For use by onoff-
CREATE INDEX IF NOT EXISTS radacct_bulk_close ON radacct (NASIPAddress, AcctStartTime) WHERE AcctStopTime IS NULL;
-- To efficiently clear stale sessions
CREATE INDEX IF NOT EXISTS radacct_bulk_timeout ON radacct (AcctStopTime NULLS FIRST, AcctUpdateTime);
-- For common statistics queries
CREATE INDEX IF NOT EXISTS radacct_start_user_idx ON radacct (AcctStartTime, UserName);
-- Online users lookups by username
CREATE INDEX IF NOT EXISTS radacct_username_active_idx ON radacct (UserName) WHERE AcctStopTime IS NULL;
-- For Class lookups
CREATE INDEX IF NOT EXISTS radacct_class_idx ON radacct (Class);

-- -----------------------------------------------------------------------------
--  radcheck — per-user check attributes (e.g. Cleartext-Password)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radcheck (
	id			serial PRIMARY KEY,
	UserName		text NOT NULL DEFAULT '',
	Attribute		text NOT NULL DEFAULT '',
	op			VARCHAR(2) NOT NULL DEFAULT '==',
	Value			text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radcheck_UserName ON radcheck (UserName, Attribute);

-- -----------------------------------------------------------------------------
--  radgroupcheck — per-group check attributes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radgroupcheck (
	id			serial PRIMARY KEY,
	GroupName		text NOT NULL DEFAULT '',
	Attribute		text NOT NULL DEFAULT '',
	op			VARCHAR(2) NOT NULL DEFAULT '==',
	Value			text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupcheck_GroupName ON radgroupcheck (GroupName, Attribute);

-- -----------------------------------------------------------------------------
--  radreply — per-user reply attributes (e.g. Framed-IP-Address, rate limits)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radreply (
	id			serial PRIMARY KEY,
	UserName		text NOT NULL DEFAULT '',
	Attribute		text NOT NULL DEFAULT '',
	op			VARCHAR(2) NOT NULL DEFAULT '=',
	Value			text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radreply_UserName ON radreply (UserName, Attribute);

-- -----------------------------------------------------------------------------
--  radgroupreply — per-group reply attributes (future: packages)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radgroupreply (
	id			serial PRIMARY KEY,
	GroupName		text NOT NULL DEFAULT '',
	Attribute		text NOT NULL DEFAULT '',
	op			VARCHAR(2) NOT NULL DEFAULT '=',
	Value			text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupreply_GroupName ON radgroupreply (GroupName, Attribute);

-- -----------------------------------------------------------------------------
--  radusergroup — user to group mapping
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radusergroup (
	id			serial PRIMARY KEY,
	UserName		text NOT NULL DEFAULT '',
	GroupName		text NOT NULL DEFAULT '',
	priority		integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS radusergroup_UserName ON radusergroup (UserName);

-- -----------------------------------------------------------------------------
--  radpostauth — authentication log (Access-Accept / Access-Reject)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radpostauth (
	id			bigserial PRIMARY KEY,
	username		text NOT NULL,
	pass			text,
	reply			text,
	CalledStationId		text,
	CallingStationId	text,
	authdate		timestamp with time zone NOT NULL default now(),
	Class			text
);
CREATE INDEX IF NOT EXISTS radpostauth_authdate_idx ON radpostauth (authdate DESC);
CREATE INDEX IF NOT EXISTS radpostauth_username_idx ON radpostauth (username);
CREATE INDEX IF NOT EXISTS radpostauth_class_idx ON radpostauth (Class);

-- -----------------------------------------------------------------------------
--  nas — RADIUS clients (read by FreeRADIUS when read_clients = yes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nas (
	id			serial PRIMARY KEY,
	nasname			text NOT NULL,
	shortname		text NOT NULL,
	type			text NOT NULL DEFAULT 'other',
	ports			integer,
	secret			text NOT NULL,
	server			text,
	community		text,
	description		text
);
CREATE INDEX IF NOT EXISTS nas_nasname ON nas (nasname);

-- -----------------------------------------------------------------------------
--  nasreload — NAS reboot tracking (used by accounting on/off queries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nasreload (
	NASIPAddress		inet PRIMARY KEY,
	ReloadTime		timestamp with time zone NOT NULL
);
