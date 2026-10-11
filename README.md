# Semnome — Planejamento do jogo

## Visão inicial
Jogo de navegação e combate marítimo em mundo 3D, com embarcações apresentadas por sprites 2.5D. Projeto mobile-first, com renderização WebGL e câmera em perspectiva.

> Documento de planejamento inicial. Especificações ainda não implementadas.

## Decisão registrada: câmera dinâmica 3D
- **Tipo:** câmera 3D dinâmica com perspectiva.
- **Suavidade de acompanhamento:** **75%** (parâmetro conceitual a calibrar; ainda sem conversão para constante física).
- **Intensidade do zoom dinâmico:** **50%** (parâmetro conceitual a calibrar).
- **Inclinação da câmera:** **65°** (convenção angular e implementação a detalhar).
- A câmera acompanha o deslocamento da embarcação e gira suavemente com as curvas, com atraso controlado.
- O zoom muda gradualmente conforme velocidade, manobras e distância dos alvos durante o combate.
- Evitar saltos de enquadramento e movimentos bruscos.
- Movimento e rotação da máquina são contínuos em coordenadas do mundo, independentes das imagens do sprite.
- A visualização de cada máquina usa sprites direcionais 2.5D com **16 direções (22,5° por quadro)**; a escolha do quadro leva em consideração o ângulo relativo entre a direção do casco e a câmera.
- A câmera e os efeitos de combate devem permanecer desacoplados da lógica de movimento e da seleção do sprite.

## Próxima decisão de arquitetura
Definir o sistema de coordenadas do oceano e das embarcações, incluindo superfície 3D, posicionamento dos sprites, física de navegação, colisões e organização das camadas de renderização.

## Referências de escopo
O GDD inicial propõe sprites de **400 × 400 px**, em uma grade **4 × 4** de **1600 × 1600 px** por embarcação. Tamanho efetivo, consistência dos ângulos e transparência dos arquivos precisam ser validados antes da integração.
