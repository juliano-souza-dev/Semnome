# SEMNOME · PACOTE 100 · 4 ETAPAS DE 25

Base de referência: vídeos de combate fornecidos pelo usuário (controles independentes, tiros em movimento, localização de inimigos, ondas e HUD). **Este documento é o plano de 100 alterações, NÃO confirmação de 100 implementações.**

Status atual: ajustes preliminares aplicados em velocidade angular da torre, precisão da mira, manobra evasiva, janela de rajadas, legibilidade do HUD e atualização da bússola. A implementação integral das tarefas abaixo requer desenvolvimento e validação adicional. A referência segura `9438de9de60427e94473eed06592a43c437592cb` permanece preservada.

## PACOTE 1 · PILOTAGEM E MIRA INDEPENDENTES
1. [ ] Separar entrada de navegação da entrada de mira
2. [ ] Criar estado independente de direção da torre
3. [ ] Permitir apontar a torre enquanto a nave curva
4. [ ] Criar analógico de mira no lado direito
5. [ ] Preservar joystick de navegação à esquerda
6. [ ] Permitir uso simultâneo dos dois controles por toque
7. [ ] Suportar dois pointerIds sem competição
8. [ ] Definir zona morta exclusiva da mira
9. [ ] Definir sensibilidade própria da mira
10. [ ] Limitar velocidade angular da torre
11. [ ] Ampliar velocidade angular enquanto o jogador mira
12. [ ] Suavizar o movimento final da torre
13. [ ] Permitir giro de 360 graus da torre
14. [ ] Manter torre orientada após soltar o analógico
15. [ ] Diferenciar travamento de alvo e mira livre
16. [ ] Criar botão para alternar mira livre e travada
17. [ ] Exibir direção atual do canhão no HUD
18. [ ] Criar retículo que representa o ponto de tiro
19. [ ] Impedir que joystick altere o rumo por engano
20. [ ] Permitir disparo durante curva
21. [ ] Permitir disparo durante propulsão
22. [ ] Permitir mudança de arma em movimento
23. [ ] Manter alvo de mira durante troca de arma
24. [ ] Adaptar controles para orientação landscape
25. [ ] Validar controles simultâneos em telas pequenas

## PACOTE 2 · COMBATE, ALCANCE E RESPOSTA
26. [ ] Definir papel tático exclusivo para Plasma
27. [ ] Definir papel tático exclusivo para Ferro
28. [ ] Definir papel tático exclusivo para Torpedo
29. [ ] Definir papel tático exclusivo para Meteoro
30. [ ] Definir papel tático exclusivo para Chuva de Energia
31. [ ] Definir papel tático exclusivo para Tempestade Orbital
32. [ ] Exibir alcance de cada arma na interface
33. [ ] Avisar quando alvo está fora do alcance
34. [ ] Calcular tempo de voo pela distância real
35. [ ] Visualizar tempo de recarga de cada disparo
36. [ ] Diferenciar velocidade dos projéteis
37. [ ] Melhorar leitura visual de tiro à distância
38. [ ] Preservar colisão varrida para projéteis velozes
39. [ ] Garantir explosão de área real do torpedo
40. [ ] Evitar dano duplicado por mesma explosão
41. [ ] Mostrar área efetiva do torpedo
42. [ ] Criar confirmação de acerto discreta
43. [ ] Criar confirmação de tiro errado sem poluição
44. [ ] Diferenciar dano direto de dano de área
45. [ ] Exibir dano com posicionamento estável
46. [ ] Controlar número simultâneo de efeitos de impacto
47. [ ] Permitir ataque enquanto a nave recebe dano
48. [ ] Criar feedback de perigo sem bloquear tela
49. [ ] Equilibrar recarga contra mobilidade
50. [ ] Validar cada arma em curta, média e longa distância

## PACOTE 3 · NPCS E CONSCIÊNCIA SITUACIONAL
51. [ ] Preservar NPCs distribuídos desde o spawn
52. [ ] Definir distância mínima entre NPCs na patrulha
53. [ ] Separar patrulheiros por setores do mapa
54. [ ] Impedir aglomeração em perseguição
55. [ ] Evitar que todos os NPCs ataquem simultaneamente
56. [ ] Criar níveis de ameaça por proximidade
57. [ ] Destacar hostil mais próximo na bússola
58. [ ] Diferenciar inimigos atrás da nave
59. [ ] Mostrar distância do inimigo selecionado
60. [ ] Mostrar quantidade de NPCs restantes
61. [ ] Exibir aviso discreto ao entrar em alcance inimigo
62. [ ] Indicar direção de projéteis hostis próximos
63. [ ] Indicar ameaça de colisão frontal
64. [ ] Priorizar combate legível em vez de excesso de efeitos
65. [ ] Diferenciar NPC que flanqueia
66. [ ] Diferenciar NPC que orbita
67. [ ] Diferenciar NPC que intercepta
68. [ ] Preservar comportamento evasivo de NPC avariado
69. [ ] Evitar colisões entre inimigos em curva
70. [ ] Variar intervalos de ataque por papel
71. [ ] Reduzir ataques de NPC fora da visão sem aviso
72. [ ] Mostrar estado de inimigo danificado
73. [ ] Destacar brevemente inimigo atingido
74. [ ] Manter inimigo destruído fora da bússola
75. [ ] Validar combate contra 1, 3 e 9 inimigos

## PACOTE 4 · ÁGUA, CÂMERA, HUD E PERFORMANCE
76. [ ] Preservar horizonte estável durante as manobras
77. [ ] Revisar distância da câmera no cruzeiro
78. [ ] Revisar distância da câmera durante esquiva
79. [ ] Evitar saltos bruscos de FOV
80. [ ] Suavizar transição da câmera tática
81. [ ] Proteger nave contra ocultação pelos efeitos
82. [ ] Limitar tremor visual causado por impactos
83. [ ] Melhorar contraste do retículo sobre a água
84. [ ] Melhorar leitura das barras de integridade
85. [ ] Manter HUD livre do centro da ação
86. [ ] Reduzir sobreposição de números de dano
87. [ ] Deixar rastro coerente em curvas fechadas
88. [ ] Ajustar intensidade do rastro na propulsão
89. [ ] Reduzir repetição geométrica visível do oceano
90. [ ] Destacar cristas de onda sem linhas grossas
91. [ ] Diminuir custo dos efeitos de espuma
92. [ ] Reutilizar geometrias de impactos recorrentes
93. [ ] Limitar efeitos simultâneos por orçamento
94. [ ] Reaproveitar materiais de efeitos equivalentes
95. [ ] Controlar densidade dos efeitos pelo desempenho
96. [ ] Verificar comportamento com FPS baixo
97. [ ] Evitar falha silenciosa no carregamento
98. [ ] Manter tela de recuperação de erro 503
99. [ ] Aplicar acessibilidade e foco visível nos controles
100. [ ] Executar checklist de regressão desktop e mobile

## Critério de conclusão
Uma tarefa só pode ser marcada [x] após implementação e revisão. Os quatro pacotes serão entregues em commits separados, com testes estáticos, verificação dos arquivos e revisão visual quando houver navegador disponível. A lista não é uma contagem inflada de mudanças cosméticas.
