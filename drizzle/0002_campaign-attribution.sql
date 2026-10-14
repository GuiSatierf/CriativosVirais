-- Pause app and worker before applying: old writers target the previous unique key.
LOCK TABLE creative_metrics, creatives, sales_events IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DROP INDEX "creative_metrics_period_unique";
--> statement-breakpoint
ALTER TABLE "creative_metrics" ADD COLUMN "campaign_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Historical CSV campaigns cannot be reconstructed from mutable creative metadata.
-- Keep their money/counts unchanged under unknown campaign until an explicit reimport.
-- Webhook events preserve their original campaigns, so rebuild derived rows exactly.
DELETE FROM creative_metrics WHERE source = 'webhook';
--> statement-breakpoint
INSERT INTO creative_metrics (
  tenant_id, creative_id, campaign_key, period_from, period_to, source, confidence,
  approved_sales, refunds, chargebacks, revenue_cents, profit_cents
)
SELECT e.tenant_id, c.id, coalesce(nullif(btrim(e.utm_campaign), ''), ''),
  (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
  (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date, 'webhook', 'observed',
  count(*) FILTER (WHERE e.status = 'approved'),
  count(*) FILTER (WHERE e.status = 'refunded'),
  count(*) FILTER (WHERE e.status = 'chargeback'),
  CASE
    WHEN count(*) FILTER (WHERE e.status IN ('approved', 'refunded', 'chargeback')) = 0 THEN NULL
    WHEN count(*) FILTER (WHERE e.status IN ('approved', 'refunded', 'chargeback') AND e.revenue_cents IS NULL) > 0 THEN NULL
    ELSE sum(CASE WHEN e.status = 'approved' THEN e.revenue_cents
      WHEN e.status IN ('refunded', 'chargeback') THEN -e.revenue_cents ELSE 0 END)
  END,
  CASE
    WHEN count(*) FILTER (WHERE e.status IN ('approved', 'refunded', 'chargeback')) = 0 THEN NULL
    WHEN count(*) FILTER (WHERE e.status IN ('approved', 'refunded', 'chargeback') AND e.profit_cents IS NULL) > 0 THEN NULL
    ELSE sum(CASE WHEN e.status = 'approved' THEN e.profit_cents
      WHEN e.status IN ('refunded', 'chargeback') THEN -e.profit_cents ELSE 0 END)
  END
FROM sales_events e JOIN creatives c ON c.tenant_id = e.tenant_id
  AND c.creative_key = coalesce(e.creative_key, e.utm_content)
GROUP BY e.tenant_id, c.id, coalesce(nullif(btrim(e.utm_campaign), ''), ''),
  (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date;
--> statement-breakpoint
CREATE UNIQUE INDEX "creative_metrics_period_unique" ON "creative_metrics" USING btree
  ("tenant_id", "creative_id", "period_from", "period_to", "source", "campaign_key");
