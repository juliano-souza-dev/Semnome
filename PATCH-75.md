# SEMNOME · PATCH 75 · COMBATE, ALCANCE E VELOCIDADE

Data: 2026-10-12. Continuação dos patches 25 e 50. **25 grupos de alterações reais**, divididos por arquivo. Valores nas unidades internas do jogo. Nenhum NPC ou progresso é resetado.

## src/main.js (12)
1. Combate básico: alcance 190→195, velocidade dos projéteis 165→175, recarga 3.0→2.7 s.
2. NPCs: alcance de tiro 215→175, recuo 31→48, projéteis 205→180 e intervalo de tiro 1.65→1.95 s.
3. Alcance independente por arma: Plasma 205, Ferro 235, Torpedo 245, Meteoro 265, Chuva 215, Orbital 360.
4. Mira começa mais adiante para torpedo/orbital e proporcionalmente para as outras armas.
5. Sensibilidade do arrasto 0.85→0.70.
6. Tempos de voo: torpedo 260→270 de velocidade nominal, orbital 3.1→3 s, Ferro ligeiramente desacelerado, Meteoro com voo um pouco mais longo.
7. Área da Chuva de Energia ampliada de 8 para 10 unidades, sem mexer no raio de 55 do torpedo.
8. Velocidade do propulsor 84→78.
9. Duração do propulsor 2→1.7 segundos.
10. Giro via joystick limitado de 4.2→3.6 rad/s (em condições equivalentes).
11. Giro por teclado reduzido de 2.35→2.15 rad/s.
12. Velocidade de ré aumentada ligeiramente de 14→15, mantendo cruzeiro em 42.

## src/enemy-ai.js (10)
13. Detecção 220→210, desligamento 290→285, distância ideal 145→155 e mínima 50→58.
14. Máximo simultâneo de atiradores 4→3; janela de pressão 0.7→0.85; cadência de referência 1.55→1.8.
15. Rotação orbital da IA desacelerada.
16. Raio de órbita aumentado para os três papéis de NPCs.
17. Distância de flanqueamento 42→55.
18. Separação entre NPCs elevada de 85 para 95, força maior para impedir amontoamento.
19. Bônus de velocidade de perseguição longa 1.12→1.08, a partir de 285 unidades.
20. Velocidades de patrulha em combate moderadas por papel.
21. Manobra evasiva em distância curta aumentada de 55→70.
22. Recuo de NPCs avariados aumentado de 42→58.

## src/naval-physics.js (2)
23. Aceleração recalibrada: boost 300→255, frenagem 58→62, ré 52→48 e marcha normal 68→62.
24. Resistência lateral maior: coeficiente de deriva 3.6→4.1 para curvas mais controladas.

## index.html (1)
25. Texto acessível do propulsor atualizado para refletir sua duração de 1,7 s.

## Critérios
- Mantido o raio grande e a colisão varrida do torpedo.
- Velocidade de cruzeiro continua 42; foco em precisão de mira, tática e separação da frota.
- Preservada a referência de recuperação 9438de9de60427e94473eed06592a43c437592cb.
- A aplicação está confirmada no GitHub; jogabilidade em dispositivos reais ainda precisa de testes.
