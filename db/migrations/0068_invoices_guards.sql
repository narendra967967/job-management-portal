-- Money records are never edited away or deleted (docs/invoices/spec.md I3, I6),
-- enforced by the database whatever the code does.
--
-- invoices: an issued invoice never changes and is never deleted. The one
-- change allowed is user_id becoming NULL, which is what deleting the account
-- does (ON DELETE SET NULL); the invoice keeps its own copy of the buyer.
-- payment_orders: never deleted (status and payment details still update as a
-- payment goes through; deleting an account only clears user_id).
--
-- Local check scripts clean up their test rows with
-- SET LOCAL session_replication_role = replica, which skips these triggers but
-- needs a database superuser. The live app's database user isn't one.

CREATE OR REPLACE FUNCTION forbid_invoice_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Invoices are never deleted (invoice %).', OLD.number;
  END IF;
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'An issued invoice never changes (invoice %).', OLD.number;
  END IF;
  IF (to_jsonb(NEW) - 'user_id') IS DISTINCT FROM (to_jsonb(OLD) - 'user_id') THEN
    RAISE EXCEPTION 'An issued invoice never changes (invoice %).', OLD.number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER invoices_immutable
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION forbid_invoice_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_order_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Payment orders are never deleted (order %).', OLD.number;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER payment_orders_never_deleted
  BEFORE DELETE ON payment_orders
  FOR EACH ROW EXECUTE FUNCTION forbid_order_delete();
