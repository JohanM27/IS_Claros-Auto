-- Publish only a small appointment identifier; never broadcast personal data or lookup hashes.
CREATE OR REPLACE FUNCTION public.can_receive_admin_appointment_updates()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."StaffProfile"
    WHERE "userId" = (SELECT auth.uid())
      AND role IN ('ADMINISTRADOR', 'RECEPCIONISTA')
  );
$$;

REVOKE ALL ON FUNCTION public.can_receive_admin_appointment_updates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_receive_admin_appointment_updates() TO authenticated;

CREATE POLICY "staff can receive appointment updates"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT realtime.topic()) = 'admin-appointments'
  AND (SELECT public.can_receive_admin_appointment_updates())
);

CREATE OR REPLACE FUNCTION public.broadcast_admin_appointment_change()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('appointmentId', NEW."id"),
    'appointment_changed',
    'admin-appointments',
    TRUE
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_admin_appointment_change() FROM PUBLIC;

CREATE TRIGGER "Appointment_broadcast_admin_changes"
AFTER INSERT OR UPDATE ON public."Appointment"
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_admin_appointment_change();
