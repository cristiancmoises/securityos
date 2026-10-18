# SecurityOS

Sistema operacional web voltado à privacidade, à pesquisa e à educação em
segurança, baseado no [daedalOS](https://github.com/DustinBrett/daedalOS).

[Acessar o SecurityOS](https://os.securityops.co) · [English — documentação principal](README.md)

O inglês é o idioma padrão. As novas janelas de serviços também oferecem
**Português (Brasil)** no seletor **Language / Idioma**, independentemente umas
das outras.

## Aplicativos na área de trabalho

Cada serviço abaixo tem aplicativo, janela, ícone e atalhos próprios na área de
trabalho e no menu Iniciar:

| Aplicativo     | Acesso                                                  | Uso                                                                                                                                        |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Liberty Office | [office.securityops.co](https://office.securityops.co/) | Documentos, planilhas e ferramentas criativas; [experimentar a demo](https://office.securityops.co/demo). Contas gratuitas incluem 100 MB. |
| Crow Studio    | [crow.securityops.co](https://crow.securityops.co/)     | Abrir o espaço de trabalho completo do Crow Studio.                                                                                        |
| Deeper         | [deeper.securityops.co](https://deeper.securityops.co/) | Abrir o cliente original do Deeper.                                                                                                        |
| Call of Roque  | [Jogo em inglês](https://callofroque.roqueos.com/en/)   | FPS tático no navegador; exige WebGPU ou WebGL 2.                                                                                          |

1. Abra o atalho do aplicativo no desktop ou no menu Iniciar.
2. Escolha o idioma da janela, se desejar.
3. Leia o aviso de conexão direta e clique em **Abrir**.
4. O cliente completo abre em outra janela ou aba do navegador. Se o navegador
   impedir a abertura, permita o link ou copie seu endereço.

Esse é o mesmo caminho compatível usado pelo cliente completo do Keywave.
Os quatro sites limitam a incorporação em outras páginas. Não removemos essas
proteções nem intermediamos arquivos, senhas ou sessões pelo proxy do SecurityOS.

## Privacidade e armazenamento

- **Direto não é anônimo.** Esses clientes não passam pelo Tor; o serviço pode ver
  seu endereço de rede. A abertura depende de uma ação explícita, sem troca
  automática de rota.
- As contas e os arquivos salvos pertencem ao serviço acessado. Encerrar o
  SecurityOS **não apaga** dados de contas remotas nem as sessões do cliente
  aberto em outra aba.
- A demo do Liberty mantém documentos apenas no navegador. Exporte seu trabalho
  antes de finalizar ou limpar a demo. As contas gratuitas do Liberty têm
  armazenamento separado da demonstração.
- O Call of Roque é um serviço independente do RoqueOS. Seus termos, licenças e
  política de privacidade continuam próprios; o atalho não implica parceria ou
  endosso.

## Outros recursos

O SecurityOS mantém seus aplicativos existentes: Tor Browser, Clearnet Browser,
Keywave, GODS EYE, IRC, Wiki, Matrix, Zupt, ferramentas locais de segurança,
editores, mídia e emuladores. O Tor Browser falha de forma fechada: não muda
silenciosamente para uma conexão direta quando o Tor não está disponível.

Para detalhes de arquitetura, instalação, desenvolvimento e limites de cada
integração, consulte o [README principal](README.md), o
[manual do sistema](public/Users/Public/Documents/SecurityOS%20Handbook.md) e a
[documentação de rotas Tor](docs/TOR.md). Não confunda a proteção de uma rota
específica com anonimato de todos os aplicativos.

## Licença

O SecurityOS segue sua [licença MIT](LICENSE) e preserva os avisos dos componentes
incluídos e do projeto de origem. Os quatro novos aplicativos são lançadores dos
serviços: não redistribuem nem modificam o código desses sites.
