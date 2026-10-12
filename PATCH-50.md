# Semnome · Patch 50 · 2026-10-12

Segundo pacote, complementar ao PATCH-25.md. Contém **25 melhorias concretas** de jogabilidade, interface e custo de renderização. Não reinicia o combate nem altera a versão segura.

## Água e propulsão
1. Espuma do rastro menos opaca na configuração base.
2. Duração menor da espuma durante o boost.
3. Duração menor da espuma em velocidade normal.
4. Tamanho inicial da espuma durante o boost reduzido.
5. Tamanho inicial da espuma normal reduzido.
6. Opacidade inicial da espuma reduzida.
7. Crescimento da espuma ao longo da vida suavizado.
8. Esmaecimento final da espuma menos agressivo.
9. Esteira só aparece acima de uma velocidade mínima mais alta.
10. Halo de propulsão com transparência base reduzida.
11. Pulso do halo de propulsão mais discreto.

## Bússola e localização
12. Atualização da bússola a cada 80 ms em vez de 100 ms.
13. Posicionamento dos marcadores com precisão decimal, reduzindo saltos visuais.
14. Marcadores traseiros indicam lado com setas diferentes.
15. Marcadores limitados a uma margem segura do HUD.
16. Estado visual especial quando não restam hostis.

## Disparos, dano e experiência
17. Máximo de números de dano simultâneos reduzido de 16 para 12.
18. Botão de disparo ganha descrição acessível da mira por toque.
19. Cada botão de arma identifica se usa câmera tática especial.
20. Texto da orientação da mira diferencia armas comuns e especiais.
21. Duração mínima do trajeto de torpedo evita animação curta demais.
22. Anel de explosão do torpedo usa menos segmentos geométricos.
23. Mira é cancelada quando o jogador é destruído.

## Mobile / apresentação
24. Pixel ratio é recalibrado ao mudar o tamanho da janela.
25. Armas especiais têm estilo próprio na barra lateral, com adaptação para telas baixas e acessibilidade a movimento reduzido.

## Notas de validação
- Commits do pacote: f93d4c8 e fa1c6b4.
- O comportamento final precisa de teste visual e de desempenho no navegador; alterações no repositório não constituem homologação.
- Referência segura para eventual recuperação: 9438de9de60427e94473eed06592a43c437592cb.
