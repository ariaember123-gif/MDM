-- ============================================================
--  MY DAILY MASSAGE — Lead Capture Database Schema
--  Compatible: MySQL 8+ / PostgreSQL 14+ / MariaDB 10.6+
--  File: schema.sql
-- ============================================================

-- ── CREATE DATABASE ───────────────────────────────
CREATE DATABASE IF NOT EXISTS mydailymassage
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mydailymassage;

-- ─────────────────────────────────────────────────
-- TABLE: leads
-- Primary lead capture records from the landing page.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- Personal Info
  first_name      VARCHAR(80)      NOT NULL,
  last_name       VARCHAR(80)      NOT NULL,
  email           VARCHAR(255)     NOT NULL,
  phone           VARCHAR(20)      DEFAULT NULL,
  zip_code        CHAR(5)          DEFAULT NULL,

  -- Qualification
  interest        ENUM(
                    'full_body',
                    'neck_shoulder',
                    'zero_gravity',
                    'budget',
                    'gift',
                    'other'
                  )                DEFAULT 'other',

  -- Consent & Compliance (TCPA / CAN-SPAM)
  consent_given   TINYINT(1)       NOT NULL DEFAULT 0,
  consent_text    TEXT             DEFAULT NULL,      -- snapshot of consent wording shown
  consent_ip      VARCHAR(45)      DEFAULT NULL,      -- IPv4 or IPv6

  -- Traffic / Attribution
  source          VARCHAR(100)     DEFAULT 'landing_page',
  utm_source      VARCHAR(100)     DEFAULT NULL,
  utm_medium      VARCHAR(100)     DEFAULT NULL,
  utm_campaign    VARCHAR(100)     DEFAULT NULL,
  utm_content     VARCHAR(100)     DEFAULT NULL,
  referrer_url    VARCHAR(2048)    DEFAULT NULL,
  user_agent      TEXT             DEFAULT NULL,

  -- CRM Sync
  shopify_customer_id  BIGINT UNSIGNED  DEFAULT NULL,  -- set after Shopify Customer created
  klaviyo_id           VARCHAR(100)     DEFAULT NULL,  -- set after Klaviyo profile sync
  mailchimp_id         VARCHAR(100)     DEFAULT NULL,

  -- Lead Lifecycle
  status          ENUM(
                    'new',
                    'contacted',
                    'qualified',
                    'converted',
                    'unsubscribed',
                    'invalid'
                  )                NOT NULL DEFAULT 'new',
  notes           TEXT             DEFAULT NULL,

  -- Timestamps
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                             ON UPDATE CURRENT_TIMESTAMP,
  contacted_at    DATETIME         DEFAULT NULL,
  converted_at    DATETIME         DEFAULT NULL,

  -- Keys
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email),
  INDEX idx_status      (status),
  INDEX idx_interest    (interest),
  INDEX idx_created_at  (created_at),
  INDEX idx_zip_code    (zip_code),
  INDEX idx_shopify_id  (shopify_customer_id)
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Landing page lead captures for My Daily Massage';


-- ─────────────────────────────────────────────────
-- TABLE: lead_events
-- Event log for all actions taken on a lead.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_events (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  lead_id     BIGINT UNSIGNED  NOT NULL,
  event_type  VARCHAR(80)      NOT NULL,   -- e.g. 'email_sent', 'sms_sent', 'page_visit', 'purchase'
  payload     JSON             DEFAULT NULL,
  created_by  VARCHAR(100)     DEFAULT 'system',
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_lead_id    (lead_id),
  INDEX idx_event_type (event_type),
  CONSTRAINT fk_le_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id)
    ON DELETE CASCADE ON UPDATE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COMMENT = 'Audit trail of all actions taken per lead';


-- ─────────────────────────────────────────────────
-- TABLE: campaigns
-- UTM campaign definitions for reporting.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150)     NOT NULL,
  utm_source  VARCHAR(100)     DEFAULT NULL,
  utm_medium  VARCHAR(100)     DEFAULT NULL,
  utm_campaign VARCHAR(100)    DEFAULT NULL,
  start_date  DATE             DEFAULT NULL,
  end_date    DATE             DEFAULT NULL,
  budget_usd  DECIMAL(10,2)    DEFAULT NULL,
  notes       TEXT             DEFAULT NULL,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_name (name)
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COMMENT = 'Marketing campaign definitions';


-- ─────────────────────────────────────────────────
-- VIEW: lead_summary
-- Quick overview for dashboards / admin panels.
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW lead_summary AS
SELECT
  l.id,
  CONCAT(l.first_name, ' ', l.last_name)   AS full_name,
  l.email,
  l.phone,
  l.zip_code,
  l.interest,
  l.status,
  l.source,
  l.utm_campaign,
  l.consent_given,
  l.shopify_customer_id,
  l.created_at,
  l.converted_at,
  COUNT(le.id)                              AS total_events
FROM leads l
LEFT JOIN lead_events le ON le.lead_id = l.id
GROUP BY l.id;


-- ─────────────────────────────────────────────────
-- STORED PROCEDURE: sp_insert_lead
-- Called from your backend API on each form submission.
-- ─────────────────────────────────────────────────
DELIMITER $$

CREATE PROCEDURE sp_insert_lead (
  IN  p_first_name   VARCHAR(80),
  IN  p_last_name    VARCHAR(80),
  IN  p_email        VARCHAR(255),
  IN  p_phone        VARCHAR(20),
  IN  p_zip_code     CHAR(5),
  IN  p_interest     VARCHAR(30),
  IN  p_consent_ip   VARCHAR(45),
  IN  p_source       VARCHAR(100),
  IN  p_utm_source   VARCHAR(100),
  IN  p_utm_medium   VARCHAR(100),
  IN  p_utm_campaign VARCHAR(100),
  IN  p_user_agent   TEXT,
  OUT p_lead_id      BIGINT UNSIGNED
)
BEGIN
  -- If email already exists, update & return existing ID
  IF EXISTS (SELECT 1 FROM leads WHERE email = p_email) THEN
    UPDATE leads
    SET
      first_name   = p_first_name,
      last_name    = p_last_name,
      phone        = COALESCE(p_phone, phone),
      zip_code     = COALESCE(p_zip_code, zip_code),
      interest     = p_interest,
      utm_campaign = COALESCE(p_utm_campaign, utm_campaign),
      updated_at   = NOW()
    WHERE email = p_email;
    SELECT id INTO p_lead_id FROM leads WHERE email = p_email;
  ELSE
    INSERT INTO leads (
      first_name, last_name, email, phone, zip_code,
      interest, consent_given, consent_ip,
      source, utm_source, utm_medium, utm_campaign,
      user_agent, status, created_at
    ) VALUES (
      p_first_name, p_last_name, p_email, p_phone, p_zip_code,
      p_interest, 1, p_consent_ip,
      p_source, p_utm_source, p_utm_medium, p_utm_campaign,
      p_user_agent, 'new', NOW()
    );
    SET p_lead_id = LAST_INSERT_ID();
  END IF;

  -- Log the submission event
  INSERT INTO lead_events (lead_id, event_type, payload, created_by)
  VALUES (
    p_lead_id,
    'form_submitted',
    JSON_OBJECT(
      'source',   p_source,
      'interest', p_interest,
      'ip',       p_consent_ip
    ),
    'landing_page'
  );
END$$

DELIMITER ;


-- ─────────────────────────────────────────────────
-- USEFUL QUERIES
-- ─────────────────────────────────────────────────

-- Total leads by status
-- SELECT status, COUNT(*) AS total FROM leads GROUP BY status;

-- Leads by interest this month
-- SELECT interest, COUNT(*) AS total
-- FROM leads
-- WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
-- GROUP BY interest
-- ORDER BY total DESC;

-- Unconverted leads older than 3 days
-- SELECT * FROM leads
-- WHERE status = 'new' AND created_at < NOW() - INTERVAL 3 DAY
-- ORDER BY created_at ASC;

-- Conversion rate
-- SELECT
--   COUNT(*)                                    AS total_leads,
--   SUM(status = 'converted')                   AS converted,
--   ROUND(SUM(status='converted')/COUNT(*)*100, 2) AS conversion_pct
-- FROM leads;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
