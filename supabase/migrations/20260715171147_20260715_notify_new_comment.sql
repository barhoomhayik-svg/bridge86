/*
# Add trigger: notify other party when a new comment is posted

## Purpose
When a comment is inserted on an order, automatically create a
`new_comment` notification for the OTHER party on that order
(i.e. if the doctor wrote it, the lab is notified, and vice-versa).

## Changes
- New function: `fn_notify_new_comment`
  - Looks up the order to find both parties
  - Inserts a notification for the party who did NOT write the message
  - Notification title: "New Message – Order #XXXX"
  - Notification body: first 120 chars of the message
  - `related_id`: the order's id (so the frontend can open it directly)
- New trigger: `trg_notify_new_comment` AFTER INSERT on `order_comments`

## Notes
- Uses SECURITY DEFINER so the trigger can write to `notifications`
  even when the inserting user doesn't have direct INSERT on it
  for other users' rows.
- Idempotent: function and trigger are replaced if they already exist.
*/

CREATE OR REPLACE FUNCTION fn_notify_new_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  order_row  orders%ROWTYPE;
  author_name text;
  notify_user uuid;
BEGIN
  SELECT * INTO order_row FROM orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT name INTO author_name FROM profiles WHERE id = NEW.author_id;

  -- Notify the OTHER party
  IF NEW.author_id = order_row.from_id THEN
    notify_user := order_row.lab_id;
  ELSE
    notify_user := order_row.from_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (
    notify_user,
    'new_comment',
    'New Message – ' || order_row.order_number,
    LEFT(NEW.body, 120),
    NEW.order_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_comment ON order_comments;
CREATE TRIGGER trg_notify_new_comment
  AFTER INSERT ON order_comments
  FOR EACH ROW EXECUTE FUNCTION fn_notify_new_comment();
