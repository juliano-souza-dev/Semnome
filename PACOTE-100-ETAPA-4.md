# SEMNOME · PACOTE 100 · ETAPA 4/4

Câmera, oceano, interface e otimização mobile.

**Estado:** 19 melhorias aplicadas em código e 6 pendentes. Não declarar a etapa como homologada sem teste em navegador e dispositivo.

1. [x] Malha do oceano reduzida de 240×240 para 190×190 segmentos
2. [x] Pool de esteira reduzido de 22 para 18 elementos
3. [x] Taxa de emissão da esteira em boost reduzida
4. [x] Taxa de emissão da esteira normal reduzida
5. [x] Limite de emissão de espuma por frame reduzido de 3 para 2
6. [x] Geometria de halo hover reduzida de 20 para 16 segmentos
7. [x] Limite de números de dano simultâneos reduzido de 12 para 9
8. [x] Fonte de dano de 23 para 21 px, reduzindo sobreposição
9. [x] Vinheta de dano mais transparente e concentrada nas bordas
10. [x] Desvanecimento de flashes de impacto mais rápido
11. [x] Escala dos flashes de impacto reduzida
12. [x] Escala das ondas de choque de impacto reduzida
13. [x] Tremor da câmera limitado em intensidade
14. [x] Máximo de 16 efeitos de impacto simultâneos
15. [x] Descarte dos efeitos de impacto em 0,40 s
16. [x] Bússola com largura máxima para telas estreitas
17. [x] Indicador de ameaças não transborda a área da bússola
18. [x] HUD superior compactado em telas baixas
19. [x] Controles com destaque de toque nativo removido
20. [ ] Refatorar o shader da água para cristas menos geométricas
21. [ ] Redesenhar transição visual da câmera de tiro especial
22. [ ] Reutilizar materiais e geometrias de explosão em pool
23. [ ] Adaptar qualidade automaticamente à taxa real de quadros
24. [ ] Medir FPS e carga gráfica em celular de entrada
25. [ ] Validar superposição de HUD em todos os formatos landscape

## Preservação

- Botão DISPARAR segue como controle de mira por arrasto e tiro ao soltar.
- Propulsão continua com controle de direção durante a esquiva.
- Nenhum reset do estado da frota.
- Versão segura de referência: `9438de9de60427e94473eed06592a43c437592cb`.

## Verificação

Código enviado à branch main. Testes de navegador, dispositivos reais e regressão visual ainda pendentes.
