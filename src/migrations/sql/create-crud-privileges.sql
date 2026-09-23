-- This syncs the auto-increment counter to the current maximum ID
SELECT setval(pg_get_serial_sequence('public.privilege', 'id'), (SELECT MAX(id) FROM public.privilege));

INSERT INTO public.privilege
(id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
VALUES
    (73, NOW(), NOW(), 'system', 'system', 'View Ticket', 'Ticket Management', 'view:ticket', 'View ticket information.'),
    (74, NOW(), NOW(), 'system', 'system', 'Delete Ticket', 'Ticket Management', 'delete:ticket', 'Delete a ticket.'),
    (75, NOW(), NOW(), 'system', 'system', 'Create Ticket', 'Ticket Management', 'create:ticket', 'Create a new ticket.'),
    (76, NOW(), NOW(), 'system', 'system', 'Edit Ticket', 'Ticket Management', 'edit:ticket', 'Edit ticket details.');
