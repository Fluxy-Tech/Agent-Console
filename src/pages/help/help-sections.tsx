import type { ReactNode } from "react";
import { BellRing, Coins, Layers, MessagesSquare, RotateCcw, Workflow, type LucideIcon } from "lucide-react";
import geminiLogo from "@/assets/LogoGermini.png";
import openaiLogo from "@/assets/LogoOpenAi.png";

/// Uma seção da tela "Dúvidas". O `id` é a âncora usada nos links de outras
/// telas (ex: /duvidas#consumo-de-tokens) — não mude um id já publicado sem
/// atualizar quem aponta pra ele (HELP_SECTION_IDS).
export interface HelpSection {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  content: ReactNode;
  questions: { question: string; answer: ReactNode }[];
}

/// Ids usados por links de outras telas.
export const HELP_SECTION_IDS = {
  tokenUsage: "consumo-de-tokens",
  agentFeatures: "funcionalidades-do-agente",
  rgbs: "rgbs",
  batchDispatch: "disparo-em-lote",
  journeyReset: "reset-de-jornada",
  campaignAlerts: "alertas-de-disparo",
} as const;

interface UsageItem {
  title: string;
  description: string;
  when: string;
}

/// Textos para quem não é da área técnica: sem siglas internas nem nomes de
/// modelos. Precisam acompanhar o que o AI-Worker realmente faz (runner.py,
/// funcionalidades.py e infra/agent_api/client.py).
const ADK_ITEMS: UsageItem[] = [
  {
    title: "Respostas ao contato",
    description:
      "Cada resposta que o agente escreve no WhatsApp é gerada pelo Gemini. Para responder, ele lê as instruções do agente, o histórico da conversa, os dados já coletados do contato e as funcionalidades disponíveis.",
    when: "A cada mensagem respondida pelo agente. Conversas longas e instruções extensas aumentam o consumo.",
  },
  {
    title: "Ações durante a conversa",
    description:
      "Quando o agente registra um dado do contato, consulta a agenda, agenda um evento ou envia um catálogo, botões, listas ou outra funcionalidade, ele faz etapas adicionais de raciocínio antes de concluir a resposta.",
    when: "Somente nas respostas em que o agente executa alguma ação.",
  },
];

const OPENAI_ITEMS: UsageItem[] = [
  {
    title: "Escolha da fila de atendimento",
    description:
      "Ao encaminhar a conversa para um atendente humano, o sistema identifica a fila mais adequada para o motivo do encaminhamento.",
    when: "Somente quando a ilha de atendimento possui mais de uma fila e o agente não indicou o nome da fila.",
  },
  {
    title: "Resumo da conversa no Kanban",
    description: "Resumo da conversa registrado como comentário no card do contato.",
    when: "Somente com a função Card no Kanban ativa, no momento configurado para ela.",
  },
  {
    title: "Mensagem de erro",
    description: "Mensagem gerada automaticamente quando o agente não consegue responder por uma falha técnica.",
    when: "Somente quando a mensagem de erro fixa está desativada na aba Mensagens fixas.",
  },
  {
    title: "Base de conhecimento (RAG)",
    description:
      "Preparo dos documentos anexados na aba RAG e consulta a esses documentos para responder às perguntas do contato.",
    when: "Somente com a base de conhecimento ativa: uma vez ao anexar cada documento e a cada consulta feita pelo agente.",
  },
];

function UsageColumn({ logo, title, subtitle, items }: { logo: string; title: string; subtitle: string; items: UsageItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="size-10 shrink-0 rounded-sm object-cover" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="border-border flex flex-col gap-1 rounded-lg border p-3">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-muted-foreground text-sm">{item.description}</p>
            <p className="text-primary text-xs font-medium">{item.when}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Subtitle({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold">{children}</p>;
}

function Topics({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title} className="border-border flex flex-col gap-1 rounded-lg border p-3">
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="text-muted-foreground text-sm">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: HELP_SECTION_IDS.tokenUsage,
    title: "Consumo de tokens",
    summary:
      "Tokens são a unidade de medida do uso da inteligência artificial: quanto mais texto o agente lê e escreve, maior o consumo. Estas são todas as situações em que há consumo e quando cada uma acontece.",
    icon: Coins,
    content: (
      <div className="grid gap-6 lg:grid-cols-2">
        <UsageColumn logo={geminiLogo} title="ADK (Gemini)" subtitle="Responsável pela conversa com o contato." items={ADK_ITEMS} />
        <UsageColumn
          logo={openaiLogo}
          title="OpenAI"
          subtitle="Responsável por tarefas de apoio. Não há consumo quando nenhuma delas acontece."
          items={OPENAI_ITEMS}
        />
      </div>
    ),
    questions: [
      {
        question: "Por que aparece consumo da OpenAI se a base de conhecimento está desativada?",
        answer:
          "A OpenAI também é usada em tarefas de apoio, como a escolha da fila ao encaminhar a conversa para um atendente, o resumo no card do Kanban e a mensagem de erro automática. Cada uma dessas tarefas consome poucos tokens e só acontece nas situações descritas acima.",
      },
      {
        question: "O que significam entrada e saída?",
        answer:
          "Entrada é tudo o que a inteligência artificial lê para trabalhar: instruções, histórico da conversa e dados do contato. Saída é o texto que ela escreve. Por isso a entrada costuma ser bem maior que a saída.",
      },
      {
        question: "Por que a soma de entrada e saída pode ficar menor que o total?",
        answer:
          "O consumo registrado antes da separação entre entrada e saída aparece apenas no total. Com o passar dos dias, essa diferença deixa de existir.",
      },
      {
        question: "Como reduzir o consumo?",
        answer:
          "Mantenha as instruções do agente objetivas, anexe à base de conhecimento apenas documentos necessários e, se a ilha de atendimento tiver várias filas, indique nas instruções do agente para qual fila encaminhar cada assunto. Assim o sistema não precisa identificar a fila sozinho.",
      },
    ],
  },
  {
    id: HELP_SECTION_IDS.agentFeatures,
    title: "Funcionalidades do agente",
    summary:
      "Na aba Função do agente, o botão Adicionar funcionalidade permite que o agente faça mais do que responder com texto. Cada funcionalidade tem uma descrição de quando deve ser usada, escrita pela sua empresa.",
    icon: Workflow,
    content: (
      <Topics
        items={[
          { title: "Agendamento de evento", text: "O agente combina dia e horário com o contato e agenda o evento na agenda de um usuário disponível." },
          { title: "Card no Kanban", text: "O agente cria o card do contato no Kanban com os dados coletados." },
          { title: "Botão de link", text: "Mensagem com um botão que abre um endereço da internet." },
          { title: "Lista de opções", text: "Menu com até 10 opções para o contato escolher." },
          { title: "Botões de resposta", text: "Até 3 botões de resposta rápida, definidos pela empresa ou criados pelo agente." },
          { title: "Carrossel de mídia", text: "De 2 a 10 cards com imagem ou vídeo, cada um com um botão de link." },
          { title: "Solicitar localização", text: "Pede a localização do contato, que fica salva no cadastro dele." },
          { title: "Catálogo e carrossel de produtos", text: "Envia produtos do catálogo da Meta, com foto e preço." },
          { title: "Respostas contextuais", text: "O agente responde citando a mensagem do contato a que se refere." },
          { title: "Prévia de link", text: "Envia um link com o título e a imagem do site." },
        ]}
      />
    ),
    questions: [
      {
        question: "O agente faz perguntas de cadastro junto com um botão ou lista?",
        answer:
          "Não. Quando o agente envia uma funcionalidade, a mensagem trata apenas daquele envio. As perguntas de cadastro voltam na próxima mensagem de texto.",
      },
      {
        question: "Por que o catálogo não aparece para seleção?",
        answer:
          "O catálogo precisa estar conectado à conta do WhatsApp da rede social vinculada ao agente, no Commerce Manager da Meta, e o acesso à Meta precisa ter permissão para catálogos.",
      },
      {
        question: "As mensagens interativas funcionam a qualquer momento?",
        answer:
          "Elas só podem ser enviadas enquanto a conversa estiver ativa, ou seja, até 24 horas depois da última mensagem do contato. Como o agente sempre responde a uma mensagem recebida, isso já é atendido normalmente.",
      },
    ],
  },
  {
    id: HELP_SECTION_IDS.rgbs,
    title: "RGBS",
    summary:
      "RGBS é a sigla de Receives, Generates, Breaks and Sends, que em português significa Recebe, Gera, Quebra e Envia. Com o RGBS ativo, o agente divide a resposta em mensagens curtas e envia uma de cada vez, com um intervalo entre elas, como uma pessoa digitando.",
    icon: MessagesSquare,
    content: (
      <div className="flex flex-col gap-4">
        <Subtitle>O que cada letra significa</Subtitle>
        <Topics
          items={[
            { title: "R de Receives (Recebe)", text: "O agente recebe a mensagem do contato." },
            { title: "G de Generates (Gera)", text: "O agente escreve a resposta completa." },
            { title: "B de Breaks (Quebra)", text: "A resposta é dividida em mensagens curtas, separadas por assunto." },
            { title: "S de Sends (Envia)", text: "As mensagens são enviadas uma de cada vez, com um intervalo entre elas." },
          ]}
        />
        <Subtitle>Intervalo antes de cada mensagem</Subtitle>
        <Topics
          items={[
            { title: "Mensagem pequena", text: "Até 40 caracteres. Intervalo mínimo de 5 segundos." },
            { title: "Mensagem média", text: "De 41 a 100 caracteres. Intervalo mínimo de 10 segundos." },
            { title: "Mensagem grande", text: "Acima de 100 caracteres. Intervalo mínimo de 15 segundos." },
          ]}
        />
      </div>
    ),
    questions: [
      {
        question: "O intervalo vale também para a primeira mensagem?",
        answer: "Sim. Cada mensagem, inclusive a primeira, aguarda o intervalo correspondente ao seu tamanho antes de ser enviada.",
      },
      {
        question: "O contato pode responder no meio das mensagens?",
        answer:
          "Pode. Nesse caso, ele recebe o aviso de que a mensagem está sendo analisada, e a nova resposta pode chegar antes de a sequência anterior terminar.",
      },
    ],
  },
  {
    id: HELP_SECTION_IDS.journeyReset,
    title: "Reset de jornada",
    summary:
      "Quando o contato envia exatamente uma das palavras de reset cadastradas na rede social, a conversa com o agente recomeça do zero.",
    icon: RotateCcw,
    content: (
      <Topics
        items={[
          { title: "O que é apagado", text: "Todos os dados coletados do contato, inclusive a localização, e a memória do agente sobre as conversas anteriores." },
          { title: "O que é mantido", text: "Nome do contato, card no Kanban, eventos agendados, histórico de mensagens, tickets e bloqueio de campanhas." },
        ]}
      />
    ),
    questions: [
      {
        question: "A palavra precisa ser escrita exatamente igual?",
        answer: "Não é preciso respeitar acentos, letras maiúsculas ou pontuação, mas a mensagem precisa conter apenas a palavra de reset.",
      },
    ],
  },
  {
    id: HELP_SECTION_IDS.batchDispatch,
    title: "Disparo em lote",
    summary:
      "No disparo em massa por arquivo CSV, os contatos não recebem a campanha todos ao mesmo tempo: o envio é feito em lotes, com um intervalo entre eles. Isso protege a reputação do número na Meta e distribui as respostas ao longo do tempo para a equipe de atendimento.",
    icon: Layers,
    content: (
      <div className="flex flex-col gap-4">
        <Subtitle>Como configurar</Subtitle>
        <Topics
          items={[
            { title: "Disparos por lote", text: "Quantidade de contatos que recebem a campanha de cada vez." },
            {
              title: "Intervalo entre lotes",
              text: "Minutos de espera entre o início de um lote e o início do próximo.",
            },
            {
              title: "Início do disparo",
              text: "Opcional. Com o agendamento ativo, o primeiro lote sai na data e no horário escolhidos. Sem agendamento, o envio começa em instantes.",
            },
            {
              title: "Duração estimada",
              text: "Calculada na própria tela. Exemplo: 100 contatos em lotes de 20, com intervalo de 10 minutos, formam 5 lotes e levam cerca de 40 minutos.",
            },
          ]}
        />
        <Subtitle>Durante o disparo</Subtitle>
        <Topics
          items={[
            {
              title: "Pausar e retomar",
              text: "Na tela da campanha, o botão Pausar interrompe o envio, inclusive no meio de um lote. O botão Retomar continua de onde parou.",
            },
            {
              title: "Alterar o destino",
              text: "Com a campanha pausada, é possível mudar se os contatos seguem com o agente de IA ou vão para uma fila de atendimento humano.",
            },
            {
              title: "Conclusão",
              text: "Quando não há mais contatos a enviar, a campanha passa para o status concluída automaticamente.",
            },
            {
              title: "Conferência dos contatos",
              text: "Antes da criação da campanha, o sistema avisa sobre contatos em atendimento, em outro disparo ou bloqueados. Veja a seção Alertas antes do disparo.",
            },
          ]}
        />
      </div>
    ),
    questions: [
      {
        question: "O disparo manual também é feito em lotes?",
        answer:
          "Não. O disparo manual é para um único contato e é enviado de uma vez, imediatamente ou no horário agendado.",
      },
      {
        question: "Um contato pode receber a mesma campanha duas vezes?",
        answer:
          "Não. Cada contato sai da lista de envio antes de a mensagem ser enviada. Se ocorrer uma falha nesse momento, o sistema prefere não reenviar a correr o risco de duplicar a mensagem.",
      },
      {
        question: "E se um lote demorar mais que o intervalo configurado?",
        answer: "O próximo lote começa logo em seguida, sem esperar um novo intervalo.",
      },
      {
        question: "Por que minha campanha foi pausada sozinha?",
        answer:
          "A campanha é pausada automaticamente quando a rede social está sem acesso à Meta configurado ou sem ilha de atendimento, pois nesse caso todos os envios falhariam. Corrija a rede social e clique em Retomar.",
      },
      {
        question: "A campanha não começou no horário. O que fazer?",
        answer:
          "Verifique se ela não está pausada. Se continuar sem envios alguns minutos após o horário previsto, entre em contato com o suporte técnico.",
      },
    ],
  },
  {
    id: HELP_SECTION_IDS.campaignAlerts,
    title: "Alertas antes do disparo",
    summary:
      "Antes de criar uma campanha, o sistema confere a lista de contatos na rede social escolhida e avisa quando algum contato precisa de atenção.",
    icon: BellRing,
    content: (
      <Topics
        items={[
          { title: "Em atendimento", text: "O contato está com um atendimento aberto, aguardando ou já com um atendente." },
          { title: "Em outro disparo", text: "O contato faz parte de outra campanha desta rede social que ainda não terminou." },
          { title: "Bloqueado", text: "O contato pediu para não receber campanhas. Ele nunca entra no disparo." },
        ]}
      />
    ),
    questions: [
      {
        question: "O que acontece quando há alertas?",
        answer:
          "Você escolhe entre remover os contatos sinalizados e disparar para os demais ou disparar mesmo assim. Os contatos bloqueados ficam fora do disparo nas duas opções.",
      },
    ],
  },
];
