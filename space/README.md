# Semnome Espacial — protótipo de migração
Primeiro marco jogável em **/space/**, separado do Semnome naval em **/**.

## Implementado
- Cena Three.js espacial, estrelas, planeta, asteroides.
- Nave do jogador em 3D e nove inimigos com movimentação e disparos.
- Seis armas selecionáveis (Plasma, Ferro, Míssil, Meteoro, Chuva de Energia, Tempestade Orbital) em versão inicial de protótipo.
- Míssil visível que acelera e curva parcialmente para perseguir alvo.
- Analógico esquerdo, tiro por arrasto e disparo ao soltar, esquiva.
- Barra de vida, radar simples e indicador de recarga.
- Entradas WASD / setas para testes no desktop.
- Áudio procedural básico, provisório.

## Limitações conhecidas
- Esta é uma **vertical slice experimental**, não a migração completa do código naval.
- Física espacial 2.5D, sem controle de subida/descida ainda.
- IA e armamentos ainda simplificados em relação à versão naval.
- Não há testes confirmados em navegadores e celulares reais.
- A rota /space/ depende da publicação do GitHub Pages do branch main.
- A versão naval permanece inalterada.
- Referência de recuperação naval: 9438de9de60427e94473eed06592a43c437592cb.

## Próximos testes
1. Abrir /space/ com celular em landscape.
2. Navegar simultaneamente com mira e tiro.
3. Usar mísseis repetidamente e trocar as seis armas.
4. Esquivar de NPCs, receber dano e reiniciar após destruição.
5. Medir fluidez em aparelho real.
