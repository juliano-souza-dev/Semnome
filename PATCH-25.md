# Semnome: Patch 25 (2026-10-12)

25 alterações pontuais aplicadas à branch main. A numeração indica alterações concretas de código, não vinte e cinco sistemas inéditos.

## Desempenho e rastro
1. Limite de pixel ratio reduzido de 1.7 para 1.5.
2. Pool da esteira reduzido de 26 para 22 elementos.
3. Frequência da esteira normal suavizada (0.085s → 0.11s).
4. Frequência da esteira com boost suavizada (0.045s → 0.065s).
5. Distância da origem da espuma atrás do casco refinada.
6. Espalhamento lateral da espuma ampliado.
7. Halo da propulsão simplificado de 24 para 20 segmentos.

## Armamentos e interface
8. Acesso rápido expandido de três para seis armas.
9. Identificador data-weapon adicionado aos botões rápidos.
10. Botões rápidos expõem aria-pressed.
11. Marcadores da bússola ocultos da leitura redundante por leitores de tela.
12. Marcadores traseiros recebem símbolo diferente.
13. Leitura da bússola mostra quantidade de hostis vivos.
14. Limite de 16 indicadores de dano simultâneos.
15. Fonte de dano reduzida para diminuir sobreposição.
16. Mira bloqueada durante a destruição/reparação da nave.
17. Botão de tiro mostra REPARANDO durante a morte.
18. Botão de tiro desabilitado durante a morte.
19. Aviso de nave reparada ao renascer.
20. O torpedo agora exibe anel de choque com raio visual próximo de 55 unidades.
21. Regra de dano em área do torpedo documentada junto à verificação de alvos.
22. Ícone do torpedo alterado de peixe para foguete.
23. Ponto inicial da mira de torpedo deslocado à frente para facilitar a aquisição de alvos.
24. Animação de explosão aceita ondas de choque sem sprite de explosão, com descarte correto.
25. Barra de armas responsiva e marcadores traseiros discretos (ajustes CSS).

## Notas
- Preserva o estado da frota, a física naval, o comportamento das armas especiais e o rollback seguro 9438de9.
- Alterações confirmadas no GitHub, mas ainda não testadas visualmente em navegador/dispositivos móveis.
- Este patch privilegia clareza e pequenos custos de renderização; ajustes de balanceamento devem ser validados jogando.
