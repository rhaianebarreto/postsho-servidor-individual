# Servidor individual PostShô

[Instalar na minha Cloudflare](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frhaianebarreto%2Fpostsho-servidor-individual)

Este modelo recebe e guarda mensagens do Telegram na conta Cloudflare da própria usuária. O aparelho continua preparando, publicando e confirmando os vídeos. Este repositório não contém o aplicativo, tokens de bot, credenciais Shopee ou dados de alunas.

## Instalar uma vez

1. Atualize o PostShô sem desinstalar e conecte seu bot individual.
2. Abra **Configurações → Meu servidor → Instalar meu servidor**. O app copia um código privado e abre o instalador acima.
3. Entre nas SUAS contas GitHub e Cloudflare. O instalador cria uma cópia deste modelo e provisiona seu Worker e seu D1.
4. No segredo **POSTSHO_SETUP**, cole o código gerado pelo app. Não use token do BotFather nesse campo. Não cole esse código em arquivos do GitHub.
5. Mantenha o comando de implantação **npm run deploy**. Ele aplica somente migrações pendentes e publica no mesmo banco. Mantenha a integração Git conectada ao repositório criado na sua conta.
6. Copie o endereço HTTPS terminado em `.workers.dev`. No PostShô, escolha **Conectar endereço do servidor**. Conclua lotes e limpezas antes da migração.
7. Confira a conexão, envie `/start` ao seu bot e teste um vídeo sem iniciar postagem. Depois valide o primeiro lote com o aparelho desbloqueado.

Não conecte o mesmo bot a dois aparelhos receptores. Se você já tem outra instalação, não a substitua sem concluir e revisar as pendências. Vídeos preparados e histórico no app não são enviados para este servidor durante a migração.

## Atualizar o aplicativo

Toque em **Verificar atualização** no PostShô e instale por cima. Não desinstale. Uma atualização compatível do app mantém o endereço, o código e o banco do servidor. Não execute novamente o instalador de servidor por causa de uma atualização do app.

## Atualizar o servidor

1. Conclua os lotes em andamento. No app, abra **Meu servidor → Atualização do meu servidor**.
2. Toque em **Atualizar meu servidor**. O app abre o workflow **Atualizar servidor PostShô** no SEU repositório GitHub.
3. Na primeira vez, habilite as Actions desse repositório caso o GitHub solicite. Clique em **Run workflow → Run workflow**.
4. O workflow copia apenas os arquivos permitidos do pacote oficial e faz um commit. O `wrangler.jsonc`, os IDs de banco, os segredos e os metadados de pareamento não são substituídos. Migrações já existentes não podem ser reescritas pelo atualizador.
5. A integração Git da Cloudflare inicia a implantação do mesmo Worker. Aguarde o status de sucesso na Cloudflare. O sucesso do workflow GitHub, sozinho, não confirma a implantação.
6. Volte ao PostShô e toque em **Conferir novamente**. O app consulta a versão realmente instalada no servidor.

Se a implantação falhar, confira o erro na Cloudflare e procure o suporte. Não crie outro banco, não apague os envios, não gere novo código e não reenvie vídeos já publicados.

## Consumo e acesso

Cada conta Cloudflare tem suas próprias cotas. Este modelo não garante consumo ilimitado nem gratuidade para qualquer volume. Os vídeos são baixados pelo aparelho diretamente do Telegram; o servidor guarda somente metadados das mensagens. O app consulta o manifesto público de atualizações no GitHub no máximo uma vez por dia ao abrir, ou quando a usuária pede uma conferência. A licença continua sendo liberada manualmente e mantém as regras de validação do aplicativo.

## Publicar uma nova versão (responsável pelo PostShô)

Atualize `src/release.mjs`, `server-release.json` e `package.json` de forma consistente. Preserve o protocolo `/v1` enquanto houver apps compatíveis em uso. Use apenas migrações adicionais, sem recriar o banco. Execute os testes, `npm run bundle` e publique o código junto com o `server-bundle.json` no repositório oficial. A atualização guiada não altera o próprio workflow ou seu atualizador: mudanças nesse mecanismo precisam de uma migração específica e validada.

## Estado desta entrega

Código e testes locais preparados. A ativação em uma conta real, o primeiro recebimento via webhook e a atualização de uma instalação real precisam ser validados antes da distribuição às alunas. Não migra nem inicia lotes automaticamente.
