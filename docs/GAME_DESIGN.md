# Semnome: regras atuais de jogo (outubro de 2026)

## Identidade
Jogo de combate naval futurista em oceano 3D estilizado, com máquinas 2.5D, mobile-first e orientação horizontal. Estética pós-batalha marítima e sucata sci-fi. Não usar embarcações piratas tradicionais.

## Navegação
- Analógico define direção e intensidade de avanço, sem marcha a ré. Velocidade máxima de teste: 72 unidades/s.
- Arrastar na água gira nave e câmera juntas, mantendo a traseira enquadrada.
- Multitouch: analógico, arrasto e disparo não devem bloquear um ao outro.
- Câmera de navegação próxima, horizonte visível; animação marítima não causa mudança involuntária de rumo.

## Combate
- Patrulheiro 01 é NPC de teste com vida infinita, colisão física sem dano e patrulha automática.
- Munições normais: trava automática até 95 unidades e dispara ao tocar em DISPARAR; não gira a nave para atirar.
- Todos os tiros atuais descem sobre o alvo seguindo trajetórias espaciais em arco.
- Câmera cinematográfica acompanha trajetória e impacto, voltando suavemente à navegação.
- Efeitos WebGL de plasma, núcleo, halo, rastro, partículas e ondas de choque.

## Arsenal
- Plasma: arco energético ciano.
- Meteoro: subida mais alta com queda energética.
- Chuva de energia: sequência de três impactos.
- Tempestade Orbital: 180 unidades de alcance, área de 22 unidades de raio, mira manual segurando/arrastando e disparo ao soltar; subida e descida lentas (~4,5 s). Patrulheiro continua indestrutível durante testes.

## Ambientação
- Oceano shader/CPU compartilhando o campo de ondas.
- Ruínas, torres e fumaça à distância em módulo procedural `src/environment.js`; cenário decorativo não interfere no combate.
- Próximas evoluções: nuvens dinâmicas refinadas, ruínas com composição artística consistente, FX atmosféricos, objetos na média distância e interações.
- Preferência por profundidade 3D, sem panorama estático colado na tela.

## Estrutura existente
- `index.html`: entrada e HUD.
- `src/styles.css`: estilo responsivo do jogo.
- `src/main.js`: loop e sistemas legados ainda integrados. **Separação interna por subsistemas continua pendente**, para preservar jogabilidade durante a transição.
- `src/environment.js`: ambientação de horizonte.
- `assets/ships/player/`: atlas direcional do jogador.

## Engenharia
- Código fonte na branch main, deploy via GitHub Pages.
- Módulos ES nativos, sem necessidade de bundle no deploy.
- Não afirmar que uma mudança foi testada em celular até haver validação real.
