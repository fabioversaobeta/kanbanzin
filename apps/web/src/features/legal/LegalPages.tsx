import { Link } from 'react-router-dom';
import { AppBackground, Brand } from '../../ui/layout';

const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();
const LAST_UPDATE = '26 de outubro de 2026';

function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppBackground>
      <header className="topbar glass">
        <Brand />
        <span className="spacer" />
        <Link to="/" className="btn btn-small">
          ←
        </Link>
      </header>
      <main className="page">
        <article className="glass legal">{children}</article>
      </main>
    </AppBackground>
  );
}

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <span>o canal de contato informado no site do serviço</span>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: {LAST_UPDATE}.</p>
      <p>
        Esta política explica como o Kanbanzin trata dados pessoais, em conformidade com a Lei Geral
        de Proteção de Dados (Lei nº 13.709/2018 – LGPD) e o Marco Civil da Internet (Lei nº
        12.965/2014).
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O controlador dos dados é o mantenedor do Kanbanzin, Fabio Bandacheski. Para exercer seus
        direitos ou tirar dúvidas, fale com: <Contact />.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> nome, e-mail e senha (armazenada apenas como hash
          criptográfico irreversível, nunca em texto puro).
        </li>
        <li>
          <strong>Conteúdo que você cria:</strong> quadros, listas, cartões, descrições, datas e
          etiquetas. Não permitimos o envio de arquivos.
        </li>
        <li>
          <strong>Registros de consentimento:</strong> versão dos Termos aceita e data/hora do
          aceite.
        </li>
        <li>
          <strong>Dados técnicos de acesso:</strong> endereço IP, data e hora e rotas acessadas,
          gerados automaticamente pela infraestrutura para segurança, prevenção a abusos e
          cumprimento do art. 15 do Marco Civil da Internet.
        </li>
      </ul>
      <p>
        Não coletamos dados pessoais sensíveis, não usamos rastreadores de terceiros nem anúncios.
      </p>

      <h2>3. Para que usamos e qual a base legal</h2>
      <ul>
        <li>
          Criar e manter sua conta e prestar o serviço — execução de contrato (art. 7º, V, LGPD).
        </li>
        <li>
          Enviar e-mails transacionais, como a recuperação de senha — execução de contrato (art. 7º,
          V).
        </li>
        <li>
          Segurança, prevenção a fraudes e abusos (limite de tentativas, bloqueio temporário) —
          legítimo interesse (art. 7º, IX).
        </li>
        <li>Guardar registros de acesso — cumprimento de obrigação legal (art. 7º, II).</li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        Usamos somente um cookie estritamente necessário (<code>kz_refresh</code>), com as flags
        HttpOnly, Secure e SameSite=Strict, para manter você conectado com segurança. Ele não serve
        para publicidade ou rastreamento e, por ser essencial, não depende de consentimento.
      </p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Usamos operadores que processam dados em nosso nome, sob contrato:</p>
      <ul>
        <li>Railway (hospedagem da API e do banco de dados);</li>
        <li>Vercel (hospedagem do site);</li>
        <li>Resend (envio de e-mails transacionais).</li>
      </ul>
      <p>
        Esses provedores podem armazenar dados fora do Brasil. Nesses casos, a transferência
        internacional ocorre com base no art. 33 da LGPD, com salvaguardas contratuais adequadas.
        Não vendemos nem compartilhamos seus dados para fins comerciais.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          Dados de conta e conteúdo: enquanto sua conta existir. Ao excluí-la, tudo é apagado.
        </li>
        <li>Registros de acesso: por até 6 meses, conforme o Marco Civil da Internet.</li>
        <li>Tokens de sessão e de recuperação de senha: apenas pelo prazo de validade.</li>
      </ul>

      <h2>7. Seus direitos (art. 18 da LGPD)</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>confirmar a existência de tratamento e acessar seus dados;</li>
        <li>corrigir dados incompletos ou desatualizados (página “Conta”);</li>
        <li>
          obter uma cópia dos seus dados em formato estruturado — botão “Baixar meus dados” na
          página “Conta”;
        </li>
        <li>excluir sua conta e todos os dados associados — página “Conta”;</li>
        <li>revogar o consentimento e obter informações sobre o compartilhamento;</li>
        <li>
          peticionar à Autoridade Nacional de Proteção de Dados (ANPD) e opor-se a tratamentos
          indevidos.
        </li>
      </ul>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas como criptografia em trânsito (HTTPS), hash de senhas com
        Argon2id, sessões com rotação de tokens, limitação de tentativas, cabeçalhos de segurança e
        isolamento dos dados entre usuários. Nenhum sistema é 100% invulnerável; em caso de
        incidente com risco relevante, comunicaremos você e a ANPD nos termos da lei.
      </p>

      <h2>9. Crianças e adolescentes</h2>
      <p>
        O serviço é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores.
      </p>

      <h2>10. Alterações</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão comunicadas no serviço, e a data
        de atualização acima será revisada.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout>
      <h1>Termos de Uso</h1>
      <p>Última atualização: {LAST_UPDATE}.</p>

      <h2>1. O serviço</h2>
      <p>
        O Kanbanzin é uma ferramenta online para organizar tarefas em quadros, listas e cartões no
        estilo Kanban. Ao criar uma conta você declara ter 18 anos ou mais e concorda com estes
        Termos e com a <Link to="/privacy">Política de Privacidade</Link>.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter a confidencialidade da sua senha.</li>
        <li>Forneça informações verdadeiras e mantenha seu e-mail atualizado.</li>
        <li>Avise-nos imediatamente se suspeitar de uso não autorizado da sua conta.</li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>É proibido usar o serviço para:</p>
      <ul>
        <li>violar leis brasileiras ou direitos de terceiros;</li>
        <li>
          armazenar ou divulgar conteúdo ilícito, ofensivo, discriminatório ou que viole direitos
          autorais;
        </li>
        <li>
          tentar acessar contas ou dados de outras pessoas, ou comprometer a segurança do serviço;
        </li>
        <li>sobrecarregar a infraestrutura com automações abusivas.</li>
      </ul>
      <p>
        O serviço não permite o envio de arquivos. Você é o único responsável pelo conteúdo textual
        que cadastra.
      </p>

      <h2>4. Seu conteúdo</h2>
      <p>
        O conteúdo é seu. Concedemos a nós mesmos apenas a licença técnica necessária para armazenar
        e exibir seus dados a você. Você pode exportar ou excluir tudo a qualquer momento.
      </p>

      <h2>5. Disponibilidade e responsabilidade</h2>
      <p>
        Empenhamo-nos para manter o serviço disponível e seguro, mas ele é fornecido “como está”,
        sem garantia de funcionamento ininterrupto. Recomendamos exportar seus dados periodicamente.
        Nos limites da lei, incluindo o Código de Defesa do Consumidor quando aplicável, não
        respondemos por lucros cessantes ou danos indiretos decorrentes do uso do serviço.
      </p>

      <h2>6. Encerramento</h2>
      <p>
        Você pode excluir sua conta quando quiser. Podemos suspender contas que violem estes Termos,
        garantida a possibilidade de exportar seus dados quando tecnicamente viável.
      </p>

      <h2>7. Alterações e foro</h2>
      <p>
        Estes Termos podem ser atualizados; mudanças relevantes serão comunicadas. Aplica-se a
        legislação brasileira, e fica eleito o foro do domicílio do usuário para dirimir
        controvérsias.
      </p>
    </LegalLayout>
  );
}
