    -- Migration para preencher appointment_numeric_id em route_stops existentes
    -- Este script tenta associar route_stops com appointments pela data da rota e endereço

    -- PASSO 1: Tentar match por data + endereço similar
    UPDATE route_stops rs
    SET appointment_numeric_id = (
    SELECT a.id
    FROM appointments a
    INNER JOIN routes r ON r.id = rs.route_id
    WHERE DATE(a.scheduled_date) = DATE(r.date)
        AND a.user_id = r.user_id
        AND (
        rs.address ILIKE '%' || a.logradouro || '%'
        OR rs.address ILIKE '%' || a.cidade || '%'
        OR rs.address ILIKE '%' || COALESCE(a.numero, '') || '%'
        )
    LIMIT 1
    )
    WHERE rs.appointment_numeric_id IS NULL
    AND rs.appointment_id IS NOT NULL;

    -- PASSO 2: Relatório de quantos registros foram preenchidos
    SELECT 
    COUNT(*) as total_route_stops,
    COUNT(appointment_numeric_id) as com_numeric_id,
    COUNT(*) - COUNT(appointment_numeric_id) as sem_numeric_id,
    ROUND(COUNT(appointment_numeric_id)::numeric / COUNT(*)::numeric * 100, 2) as percentual_preenchido
    FROM route_stops;

    -- PASSO 3: Mostrar os que ainda estão NULL (para análise manual)
    SELECT 
    rs.id as route_stop_id,
    r.id as route_id,
    r.display_number as romaneio_numero,
    r.date as route_date,
    r.title as route_title,
    rs.address as stop_address,
    rs."order" as stop_order
    FROM route_stops rs
    INNER JOIN routes r ON r.id = rs.route_id
    WHERE rs.appointment_numeric_id IS NULL
    ORDER BY r.date DESC, r.display_number DESC, rs."order";

    -- NOTA: Se ainda houver registros NULL após executar este script,
    -- significa que esses route_stops não têm um appointment correspondente
    -- ou o endereço é muito diferente. Esses podem ser ignorados ou corrigidos manualmente.
