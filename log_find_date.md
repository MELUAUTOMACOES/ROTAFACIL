 [FIND-DATE] Iniciando busca de datas disponíveis: {
[api]   clientId: 7,
[api]   cep: '81830-040',
[api]   numero: '123',
[api]   logradouro: 'Rua Ribeirão do Pinhal',
[api]   cidade: 'Curitiba',
[api]   serviceId: 1,
[api]   technicianId: undefined,
[api]   teamId: undefined
[api] }
[api] ✅ [FIND-DATE] Coordenadas do destino: { targetLat: -25.5125015, targetLng: -49.2713445 }
[api] ✅ [FIND-DATE] Encontrados 3 responsáveis compatíveis
[api] ✅ [FIND-DATE] Preparação de metadados concluída. Iniciando busca Lazy...
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-04 (domingo)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ❌ [REJEITADO] Não trabalha em domingo. Dias de trabalho: segunda, terca, quarta, quinta, sexta, sabado
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em domingo
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ❌ [REJEITADO] Não trabalha em domingo. Dias de trabalho: segunda, terca, quarta, quinta, sexta
[api]   ❌ [DIA DESCARTADO] 2026-01-04 - Nenhum responsável atende aos critérios
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-05 (segunda)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em segunda
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em segunda
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em segunda
[api]     ✓ Tempo disponível: 420min (necessário: 60min)
[api]     📏 [COM AGENDAMENTOS] Pulando pré-filtro Haversine, usando apenas OSRM delta
[api]   ✅ [OSRM] Distance: 7.17km
[api]   ✅ [OSRM] Distance: 11.80km
[api]   ✅ [OSRM] Distance: 7.81km
[api]   ✅ [OSRM] Distance: 8.09km
[api]   🎯 [INSERTION] Best position: 2, delta: +8.09km
[api]     📏 [OSRM] Delta de inserção: 8.1km (limite: 5km)
[api]     ❌ [REJEITADO] Delta OSRM: 8.1km > 5km
[api]   ❌ [DIA DESCARTADO] 2026-01-05 - Nenhum responsável atende aos critérios
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-06 (terca)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em terca
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em terca
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em terca
[api]     ✓ Tempo disponível: 480min (necessário: 60min)
[api]     ⚠️ [DISTANCE] Dia com agendamentos mas sem coordenadas válidas
[api]   ❌ [DIA DESCARTADO] 2026-01-06 - Nenhum responsável atende aos critérios
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-07 (quarta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   ✅ [OSRM] Distance: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-07 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-08 (quinta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-08 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-09 (sexta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-09 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-10 (sabado)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em sabado
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ❌ [REJEITADO] Não trabalha em sabado. Dias de trabalho: segunda, terca, quarta, quinta, sexta, domingo
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ❌ [REJEITADO] Não trabalha em sabado. Dias de trabalho: segunda, terca, quarta, quinta, sexta
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-10 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-11 (domingo)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ❌ [REJEITADO] Não trabalha em domingo. Dias de trabalho: segunda, terca, quarta, quinta, sexta, sabado
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em domingo
[api]     ❌ [REJEITADO] Sem tempo suficiente. Disponível: 0min / Necessário: 60min
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ❌ [REJEITADO] Não trabalha em domingo. Dias de trabalho: segunda, terca, quarta, quinta, sexta
[api]   ❌ [DIA DESCARTADO] 2026-01-11 - Nenhum responsável atende aos critérios
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-12 (segunda)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em segunda
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em segunda
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em segunda
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-12 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-13 (terca)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em terca
[api] 1:29:33 PM [express] GET /api/check-access 304 in 45ms :: {"allowed":true,"minutesUntilEnd":null}
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em terca
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em terca
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-13 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-14 (quarta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em quarta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-14 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-15 (quinta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em quinta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-15 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-16 (sexta)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ✓ Trabalha em sexta
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-16 - FLAVIO COSTA (0.76km)
[api]
[api] 📅 [VERIFICANDO DIA] 2026-01-17 (sabado)
[api]   👤 [RESPONSÁVEL] FLAVIO COSTA (technician)
[api]     ✓ Trabalha em sabado
[api]     ✓ Tempo disponível: 540min (necessário: 60min)
[api]     📏 [DIA VAZIO] Haversine da base: 0.6km (limite pré-filtro: 75.0km)
[api]   📦 [OSRM-CACHE] Hit: 0.76km
[api]     📏 [DIA VAZIO] OSRM da base: 0.8km (limite: 100km)
[api]     ✅ [APROVADO] Distância da base: 0.76km
[api]   👤 [RESPONSÁVEL] FELIPE COSTA (technician)
[api]     ❌ [REJEITADO] Não trabalha em sabado. Dias de trabalho: segunda, terca, quarta, quinta, sexta, domingo
[api]   👤 [RESPONSÁVEL] EQUIPE PINTURA (team)
[api]     ❌ [REJEITADO] Não trabalha em sabado. Dias de trabalho: segunda, terca, quarta, quinta, sexta
[api]   ✨ CANDIDATO ADICIONADO: 2026-01-17 - FLAVIO COSTA (0.76km)
[api]
[api] 📊 [FIND-DATE] Resumo Final (3 prestadores analisados):
[api]   - Dias verificados: 14
[api]   - Rejeitados (não é dia de trabalho): 8
[api]   - Rejeitados (sem tempo livre): 6
[api]   - Rejeitados (pré-filtro Haversine): 0
[api]   - Rejeitados (OSRM distância real): 1
[api]   - Erros geocodificação: 1
[api]   - ✅ Candidatos encontrados: 10
[api]
[api] 🌐 [OSRM] Estatísticas de chamadas:
[api]   - Chamadas bem-sucedidas: 5
[api]   - Hits de cache: 25
[api]   - Fallbacks (erro): 0
[api]
[api] 🎯 [FIND-DATE] Busca concluída! 10 opções encontradas
[api] 📊 [METRICS] Rastreando: find_date.search (User: 1, Company: undefined)
[api] 1:29:46 PM [express] POST /api/scheduling/find-available-dates 200 in 29550ms
[api] ✅ [METRICS] Salvo com sucesso! ID: 19