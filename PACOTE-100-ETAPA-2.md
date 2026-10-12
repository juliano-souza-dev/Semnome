# Semnome · Pacote 100 · Etapa 2/4: combate, alcance e resposta

Entrega de 25 alterações de código relacionadas a parâmetros, visualização e resposta das seis armas. O **botão DISPARAR continua sendo a mira por arrasto e tiro ao soltar**; não foi criado analógico extra.

1. Centralização dos parâmetros de combate em WEAPON_STATS
2. Alcance do Plasma definido em 205 unidades
3. Alcance do Ferro definido em 235 unidades
4. Alcance do Torpedo definido em 245 unidades
5. Alcance do Meteoro definido em 265 unidades
6. Alcance da Chuva definido em 215 unidades
7. Alcance da Tempestade Orbital definido em 360 unidades
8. Recarga própria por arma: 2,1 a 5,0 segundos
9. Temporizador de recarga independente por arma
10. Bloqueio de início da mira apenas para a arma em recarga
11. Registro da recarga no momento de disparar
12. Dano próprio por arma; mantém Torpedo 55 e Ferro 40
13. Raio de impacto definido por perfil de armamento
14. Botão de tiro exibe recarga da arma selecionada
15. Descrição acessível do botão acompanha arma e recarga
16. Barra de progresso circular de recarga no botão DISPARAR
17. Tooltip da barra de armamento mostra alcance e recarga
18. Menu completo de armas mostra alcance e recarga
19. Disparo manual respeita alcance efetivo
20. Ponto inicial da mira ajustado por alcance
21. Assistência de mira considera a área da arma
22. Dica na mira informa nome e alcance da arma
23. Torpedo passa de velocidade nominal 270 para 285
24. Anel de choque do torpedo ganha geometria revisada
25. Disparos secundários da Chuva usam dano do seu próprio perfil

## Perfis atuais

| Arma | Alcance | Recarga (s) | Dano principal | Raio do impacto |
|---|---:|---:|---:|---:|
| Plasma | 205 | 2,1 | 25 | 8 |
| Ferro | 235 | 2,5 | 40 | 8 |
| Torpedo | 245 | 4,2 | 55 | 55 |
| Meteoro | 265 | 3,4 | 32 | 11 |
| Chuva de Energia | 215 | 3,3 | 22 | 10 |
| Tempestade Orbital | 360 | 5,0 | 45 | 22 |

Recargas independentes permitem trocar de arma enquanto outra recarrega. A Chuva de Energia lança projéteis secundários com dano próprio inferior ao principal.

## Limites e validação

- O pacote altera efetivamente os perfis e o funcionamento da interface; a experiência em navegador real **ainda não foi homologada**.
- São 25 alterações e parâmetros rastreáveis, não 25 sistemas inteiramente inéditos.
- Manter a referência segura `9438de9de60427e94473eed06592a43c437592cb`.
- Próxima etapa: NPCs, ameaças e leitura situacional, sem aglomerar a frota.
