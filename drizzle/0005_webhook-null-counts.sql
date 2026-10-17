-- 0002 rebuilt webhook rows with count(*) FILTER, which wrote 0 sales, refunds and
-- chargebacks on days that only had pending, cancelled or failed events. Those days
-- have no observed counts, so they become NULL, as the ingest-event worker writes them.
UPDATE creative_metrics m
SET approved_sales = NULL, refunds = NULL, chargebacks = NULL
WHERE m.source = 'webhook'
  AND NOT EXISTS (
    SELECT 1
    FROM sales_events e
    JOIN creatives c ON c.tenant_id = e.tenant_id
      AND c.creative_key = coalesce(e.creative_key, e.utm_content)
    WHERE e.tenant_id = m.tenant_id
      AND c.id = m.creative_id
      AND coalesce(nullif(btrim(e.utm_campaign), ''), '') = m.campaign_key
      AND (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date = m.period_from
      AND e.status IN ('approved', 'refunded', 'chargeback')
  );
