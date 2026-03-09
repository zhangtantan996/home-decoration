-- Tinode IM System Database Schema
-- Migration: 001_create_tinode_tables.sql
-- Purpose: Create core tables for Tinode instant messaging system
-- Note: Using tinode_ prefix to avoid conflicts with existing users table

-- ============================================================================
-- 1. tinode_users - User accounts and profiles
-- ============================================================================
-- Stores user authentication, profile data, and device information
-- Note: id is VARCHAR to support Tinode's usr{userID} format (e.g., usr123)
CREATE TABLE tinode_users (
    id VARCHAR(255) PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state INT NOT NULL DEFAULT 0,  -- 0: active, 1: disabled
    stateat TIMESTAMP,
    lastseen TIMESTAMP,

    -- Profile information
    public JSONB,     -- Public profile: {"fn": "display_name", "photo": "avatar_url"}
    trusted JSONB,    -- Trusted data: {"tel": "phone_number", "email": "email"}
    tags TEXT[],      -- User tags: ["designer", "customer", "verified"]

    -- Authentication
    passhash BYTEA,   -- Password hash (if using password auth)

    -- Device management
    deviceids TEXT[]  -- Push notification device tokens
);

CREATE INDEX idx_tinode_users_state ON tinode_users(state);
CREATE INDEX idx_tinode_users_lastseen ON tinode_users(lastseen DESC);
CREATE INDEX idx_tinode_users_tags ON tinode_users USING gin(tags);

-- ============================================================================
-- 2. tinode_topics - Conversation topics (1-on-1 or group chats)
-- ============================================================================
-- Stores conversation metadata and access control
-- Topic name format for 1-on-1: "usr{id1}_usr{id2}"
CREATE TABLE tinode_topics (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Topic identifier
    name VARCHAR(255) NOT NULL UNIQUE,  -- e.g., "usr1_usr2"

    -- Access control
    access JSONB,     -- {"auth": "JRWPS", "anon": "N"}
                      -- J: Join, R: Read, W: Write, P: Presence, S: Share
    owner VARCHAR(255),

    -- Metadata
    public JSONB,     -- Public topic information
    trusted JSONB,    -- Private topic information
    tags TEXT[],

    -- Message tracking
    seqid INT NOT NULL DEFAULT 0,  -- Latest message sequence number
    delid INT DEFAULT 0,           -- Deletion marker
    touchedat TIMESTAMP            -- Last activity timestamp
);

CREATE INDEX idx_tinode_topics_name ON tinode_topics(name);
CREATE INDEX idx_tinode_topics_owner ON tinode_topics(owner);
CREATE INDEX idx_tinode_topics_touchedat ON tinode_topics(touchedat DESC);
CREATE INDEX idx_tinode_topics_tags ON tinode_topics USING gin(tags);

-- ============================================================================
-- 3. tinode_messages - Chat messages
-- ============================================================================
-- Stores all messages with content and metadata
CREATE TABLE tinode_messages (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Conversation context
    topic VARCHAR(255) NOT NULL,  -- References tinode_topics.name
    from_user VARCHAR(255) NOT NULL,

    -- Message content
    head JSONB,        -- Message headers (metadata, MIME type)
    content JSONB,     -- Message body: {"txt": "text", "fmt": [formatting]}

    -- Sequencing
    seqid INT NOT NULL,

    -- Deletion tracking
    delid INT DEFAULT 0,
    deletedfor TEXT[]  -- List of user IDs who deleted this message
);

CREATE INDEX idx_tinode_messages_topic_seqid ON tinode_messages(topic, seqid DESC);
CREATE INDEX idx_tinode_messages_topic_delid ON tinode_messages(topic, delid DESC);
CREATE INDEX idx_tinode_messages_from_user ON tinode_messages(from_user);

-- ============================================================================
-- 4. tinode_subscriptions - User-topic relationships
-- ============================================================================
-- Tracks which users are subscribed to which topics and their read status
CREATE TABLE tinode_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Relationship
    topic VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,

    -- Permissions
    modewant VARCHAR(32),   -- Desired permissions: "JRWPS"
    modegiven VARCHAR(32),  -- Granted permissions: "JRWPS"

    -- Read status tracking
    readseqid INT DEFAULT 0,    -- Last read message sequence number
    recvseqid INT DEFAULT 0,    -- Last received message sequence number

    -- History management
    clearid INT DEFAULT 0,      -- Clear history up to this sequence number

    -- User-specific topic data
    private JSONB,              -- User's private data for this topic

    UNIQUE(topic, user_id)
);

CREATE INDEX idx_tinode_subs_topic ON tinode_subscriptions(topic);
CREATE INDEX idx_tinode_subs_user ON tinode_subscriptions(user_id);
CREATE INDEX idx_tinode_subs_user_updated ON tinode_subscriptions(user_id, updatedat DESC);

-- ============================================================================
-- End of migration
-- ============================================================================
