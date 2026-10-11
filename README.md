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


## Decisão registrada: oceano violento com resposta da embarcação às ondas
- **Requisito inicial:** oceano com ondas fortes e irregulares; a embarcação do jogador deve responder ao movimento da superfície em tempo real.
- A máquina sobe e desce com a altura das ondas, inclina-se longitudinalmente (pitch) e lateralmente (roll), com amortecimento e inércia perceptíveis.
- A superfície e o sistema de flutuação devem consultar a **mesma função de ondas**, evitando divergência entre a água visual e a posição do casco.
- **Proposta técnica inicial, a validar em protótipo:** superfície WebGL com ondas Gerstner combinadas e amostragem de múltiplos pontos do casco para estimar altura e normal/inclinação.
- Espuma, respingos e esteira devem reagir ao movimento relativo do casco e da água; não substituir o movimento físico.
- **Restrição 2.5D:** a direção horizontal usa sprites de 16 ângulos, mas grandes rotações em pitch/roll não podem ser representadas corretamente por um único sprite plano. Começar com inclinações visualmente controladas e validar se são necessários quadros adicionais ou uma representação híbrida.
- **Desempenho:** priorizar mobile-first e simulação aproximada, sem simulação completa de fluidos.
- **Decisão confirmada:** as ondas também afetam a **velocidade** da embarcação. Subidas e ondas contrárias aumentam a resistência; descidas e ondas a favor podem acelerar; impactos com ondas grandes podem causar desaceleração repentina.
- O efeito na velocidade depende da geometria, movimento e direção relativa das ondas; não deve ser uma alteração arbitrária ligada à animação visual.
- **Decisão confirmada:** o jogador mantém **controle total da direção**. Ondas não alteram o rumo (yaw) nem aplicam desvio lateral involuntário; direção e orientação horizontal seguem os comandos do jogador.
- A simulação das ondas pode alterar velocidade, altura, pitch e roll, mas esses efeitos são desacoplados do controle de yaw. Inclinações visuais não devem mudar a orientação de navegação.
- **Pendências:** intensidade das ondas, força de flutuação, amortecimento, limites de inclinação e calibração da resistência/impulso.

## Próxima decisão de arquitetura
Definir o sistema de coordenadas do oceano e das embarcações, incluindo superfície 3D, posicionamento dos sprites, física de navegação, colisões e organização das camadas de renderização.

## Referências de escopo
O GDD inicial propõe sprites de **400 × 400 px**, em uma grade **4 × 4** de **1600 × 1600 px** por embarcação. Tamanho efetivo, consistência dos ângulos e transparência dos arquivos precisam ser validados antes da integração.

## Decisão registrada: colisões físicas entre máquinas
- Embarcações possuem colisores físicos e não podem atravessar umas às outras.
- Choques entre máquinas produzem resposta de contato, empurrões e transferência simplificada de impulso, considerando velocidade relativa, massa e ponto de impacto.
- A resposta da colisão deve coexistir com a navegação sob ondas, sem permitir que as ondas desviem involuntariamente o rumo do jogador. O impacto pode deslocar fisicamente as máquinas; o controle de orientação (yaw) permanece com o jogador.
- Dano por colisão, limites de impulso, duração do empurrão e interação com estruturas fixas serão definidos posteriormente.
- Para mobile, priorizar colisores simples e simulação estável, separando lógica física dos sprites 2.5D.

## Decisão registrada: colisões sem dano
- Colisões físicas entre embarcações causam **somente empurrões e deslocamentos**, **sem perda de vida ou dano ao casco**.
- A força do empurrão poderá variar com massa, velocidade relativa e ponto de contato, respeitando uma simulação estável em dispositivos móveis.
- A reação física de impacto não deve alterar diretamente o comando direcional do jogador; após o empurrão, ele continua controlando o rumo.
- Essa regra diz respeito ao contato entre embarcações; dano por armas e outras fontes será definido em separado.

## Decisão registrada: propulsão e aceleração
- **Opção B aprovada:** aceleração rápida e responsiva. A máquina alcança velocidades altas em pouco tempo, sem longa fase de aceleração.
- A resposta aos comandos deve ser ágil para combate, mesmo com ondas violentas.
- As ondas continuam alterando a **velocidade** durante a navegação; o jogador mantém controle total do rumo.
- Valores numéricos de aceleração, velocidade máxima, frenagem e curva serão calibrados no protótipo, sem assumir números definitivos neste documento.

## Decisão registrada: frenagem
- **Opção B aprovada:** ao soltar o acelerador, a máquina **desacelera rapidamente**, favorecendo manobras precisas em combate.
- A desaceleração deve ser suave o suficiente para evitar paradas visualmente abruptas, mas sem longa deriva por inércia.
- O movimento vertical e a inclinação seguem reagindo às ondas; o jogador permanece no controle do rumo.
- O tempo de frenagem e a resistência da água serão calibrados no protótipo e não estão fixados numericamente.

## Decisão registrada: navegação em 360°, sem marcha à ré
- Máquinas **não possuem marcha à ré**: não se deslocam para trás por comando de propulsão.
- Podem **girar livremente em 360°** para escolher qualquer rumo no plano horizontal e então acelerar para a frente na direção da proa.
- O giro é controlado pelo jogador; as ondas afetam altura, inclinação e velocidade, mas não mudam involuntariamente o rumo.
- A representação visual da orientação horizontal usa os 16 quadros direcionais (22,5° entre quadros), enquanto o ângulo real da física permanece contínuo.
- Colisões podem gerar deslocamentos físicos temporários sem constituírem marcha à ré controlada.

## Decisão registrada: curva exige deslocamento
- **Opção B aprovada:** máquinas **não giram sobre o próprio eixo quando estão paradas**.
- É necessário movimento de avanço para virar; a capacidade de curva aumenta com o deslocamento e desaparece em repouso.
- O jogador controla o rumo de 360°, porém a orientação muda apenas enquanto existe deslocamento de avanço suficiente.
- Os parâmetros de raio de curva e resposta em baixa velocidade serão calibrados no protótipo.

## Decisão registrada: curvas fechadas em alta velocidade
- **Opção A aprovada:** máquinas conseguem realizar **curvas fechadas mesmo em alta velocidade**, priorizando combate arcade ágil.
- Não é necessário reduzir velocidade para executar uma curva fechada; ajustar a velocidade por efeito das ondas continua válido.
- O giro depende de movimento de avanço: máquinas paradas não giram no próprio eixo.
- A orientação permanece controlada pelo jogador e a rotação é contínua em 360°, representada visualmente por sprites de 16 direções.
- Taxa de giro máxima, raio de curva e suavização serão calibrados no protótipo para manter manobras responsivas sem produzir trancos visuais.

## Decisão registrada: estabilidade do casco durante curvas
- **Opção B aprovada:** curvas fechadas, inclusive em alta velocidade, **não produzem inclinação lateral adicional do casco**.
- O casco permanece relativamente estável durante manobras; **pitch e roll respondem às ondas**, não à intensidade da curva.
- Manter curvas ágeis, sem giro quando parado, controle direcional do jogador e influência das ondas na velocidade.
- A câmera dinâmica pode acompanhar as curvas suavemente, mas não deve simular inclinação do casco causada por forças centrífugas.

## Decisão registrada: perda breve de contato em ondas gigantes
- Ondas excepcionalmente grandes podem fazer a embarcação **perder contato com a água por um curto instante**, num semi-salto, sem efeito acrobático.
- Sequência: subida na crista, breve separação da superfície, pequeno deslocamento no ar e retorno com impacto visual.
- Altura e duração devem permanecer sutis, ajustadas à escala 3D do jogo em protótipo; sem definir agora um número arbitrário de pixels.
- Durante a separação, reduzir a espuma de contato; ao retornar, gerar respingos e feedback discreto de câmera.
- Não aplicar rotações extremas ou grandes inclinações que prejudiquem a credibilidade dos sprites 2.5D.
- Preservar controle direcional do jogador; as ondas não induzem desvio de rumo.

## Direção artística aprovada: oceano de jogo de ação
- Visual estilizado de **jogo de ação**, com ondas volumosas e intensas, cores azul-turquesa, cristas claras, espuma marcante e movimento expressivo.
- Não buscar realismo fotográfico; preservar leitura visual da embarcação e bom desempenho mobile.

## Protótipo inicial (em desenvolvimento)
- `index.html`: demonstração WebGL com Three.js importado por CDN, oceano procedural com ondas direcionais e embarcação temporária em geometria 3D simples.
- O oceano e o movimento do casco consultam a mesma função matemática de ondas, com versão equivalente em GLSL e JavaScript.
- Controles iniciais: teclado (W/↑, A/D ou setas) e analógico/toque no celular.
- Movimentação em 360°, aceleração rápida, frenagem rápida, curvas durante deslocamento, altura/pitch/roll conforme ondas e ajuste de velocidade pelo gradiente da água.
- Câmera de perspectiva inclinada a 65° com acompanhamento suavizado e afastamento dependente de velocidade. As porcentagens de suavização e zoom permanecem metas de design para calibração.
- **Ainda não implementados:** sprite real 2.5D em 16 direções, semi-saltos, colisões entre máquinas, combate, espuma por contato, partículas e testes físicos/visuais em dispositivos reais.
- Para executar: hospedar como página estática (por exemplo, GitHub Pages), com conexão à internet para carregar Three.js por CDN; pode exigir um servidor HTTP local em vez de abrir o arquivo diretamente.

## Decisão implementada: analógico único mobile
- Botão separado de aceleração removido.
- Analógico mobile tem **360° de orientação absoluta**: a posição do dedo determina a direção pretendida da proa; a distância ao centro determina o comando de velocidade.
- O casco avança para a frente na direção da proa, **sem marcha à ré** e **sem girar continuamente** quando o dedo fica mantido numa direção.
- O giro segue o menor caminho angular e requer velocidade de avanço; ao soltar o analógico, há frenagem rápida.
- Teclado permanece como suporte opcional para testes no navegador.

## Orientação do jogo: landscape
- Jogo mobile projetado para **tela horizontal**. A interface e o enquadramento devem priorizar a largura disponível.
- Em modo retrato em dispositivos touchscreen, exibir aviso para girar o aparelho; oferecer tentativa de tela cheia e bloqueio de orientação quando o navegador permitir. Navegadores que não permitem bloquear orientação exigem rotação manual.
- HUD compacto e analógico posicionado no canto inferior esquerdo, sem botão de aceleração separado.

## Correção do analógico com câmera orbitável
- O analógico é interpretado **relativamente à câmera no instante em que o jogador inicia o gesto**, não em eixos globais fixos.
- O referencial angular é mantido durante o mesmo toque para impedir inversões ou giro contínuo conforme a câmera acompanha a embarcação.
- Soltar e tocar novamente captura a orientação atual da câmera, preservando controle contextual em 360°.

## Protótipo inicial de combate
- Aceleração máxima de navegação aumentada de **24 para 72 unidades/s** (3x), com resposta das ondas proporcional.
- O NPC Patrulheiro 01 é **selecionado automaticamente ao entrar no alcance do canhão**, inicialmente 95 unidades.
- HUD exibe `ALVO TRAVADO`, a vida do NPC e botão `DISPARAR` no lado direito da tela horizontal.
- Disparo acontece **somente ao pressionar o botão** (sem tiro automático contínuo).
- Protótipo usa projétil visual de esfera, velocidade 165 unidades/s, dano 25, intervalo mínimo de 0,65s e NPC com 100 HP; todos são valores de teste.
- Disparo de teste mira na posição do NPC ao apertar o botão; trajetória não é guiada depois do lançamento. A regra definitiva de orientação do canhão frontal fixo e aquisição de alvos será refinada.
- O NPC ainda não ataca automaticamente o jogador. Ataque do NPC ao detectar jogador no alcance é o próximo comportamento a desenvolver.
