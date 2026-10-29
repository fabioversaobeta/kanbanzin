/** All user-facing copy (pt-BR). Keeping it in one place makes adding locales straightforward. */
export const m = {
  appName: 'Kanbanzin',
  loading: 'Carregando…',
  cancel: 'Cancelar',
  save: 'Salvar',
  create: 'Criar',
  delete: 'Excluir',
  close: 'Fechar',
  back: 'Voltar',
  confirm: 'Confirmar',
  genericError: 'Algo deu errado. Tente novamente.',
  networkError: 'Não foi possível conectar ao servidor. Verifique sua conexão.',

  errors: {
    invalid_credentials: 'E-mail ou senha incorretos.',
    account_locked: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    rate_limited: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    email_taken: 'Este e-mail já está cadastrado.',
    invalid_email: 'Informe um e-mail válido.',
    invalid_name: 'O nome deve ter entre 1 e 80 caracteres.',
    weak_password: 'Senha fraca: use ao menos 10 caracteres e evite senhas comuns.',
    terms_not_accepted: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.',
    invalid_reset_token: 'Este link é inválido ou expirou. Solicite um novo.',
    wrong_password: 'Senha incorreta.',
    limit_reached: 'Você atingiu o limite permitido.',
    invalid_title: 'Informe um título válido.',
    invalid_color: 'Escolha uma cor válida.',
    superpower_disabled: 'Ative este superpoder no quadro primeiro.',
    not_found: 'Item não encontrado.',
  } as Record<string, string>,

  auth: {
    loginTitle: 'Entrar',
    loginSubtitle: 'Bem-vindo de volta ao Kanbanzin.',
    registerTitle: 'Criar conta',
    registerSubtitle: 'Organize seus projetos em quadros Kanban.',
    email: 'E-mail',
    password: 'Senha',
    name: 'Nome',
    newPassword: 'Nova senha',
    passwordHint: 'Mínimo de 10 caracteres. Frases longas são mais seguras.',
    signIn: 'Entrar',
    signUp: 'Criar conta',
    signOut: 'Sair',
    forgot: 'Esqueci minha senha',
    noAccount: 'Ainda não tem conta?',
    haveAccount: 'Já tem conta?',
    acceptPrefix: 'Li e aceito os',
    terms: 'Termos de Uso',
    and: 'e a',
    privacy: 'Política de Privacidade',
    forgotTitle: 'Recuperar senha',
    forgotSubtitle: 'Informe seu e-mail e enviaremos um link para criar uma nova senha.',
    forgotSend: 'Enviar link',
    forgotDone:
      'Se o e-mail estiver cadastrado, você receberá as instruções em instantes. Verifique também o spam.',
    backToLogin: 'Voltar para o login',
    resetTitle: 'Criar nova senha',
    resetSubtitle: 'Escolha uma senha forte que você não usa em outros lugares.',
    resetSave: 'Salvar nova senha',
    resetMissingToken: 'Link inválido. Solicite um novo link de recuperação.',
    resetDone: 'Senha alterada! Entre com a nova senha.',
  },

  boards: {
    title: 'Seus quadros',
    subtitle: 'Crie um quadro para cada projeto, equipe ou ideia.',
    newBoard: 'Criar quadro',
    boardTitle: 'Título do quadro',
    boardTitlePlaceholder: 'Ex.: Lançamento do produto',
    color: 'Cor',
    customColor: 'Cor personalizada',
    empty: 'Você ainda não tem quadros. Crie o primeiro!',
    account: 'Conta',
    myBoards: 'Meus quadros',
    deleteBoard: 'Excluir quadro',
    deleteBoardConfirm:
      'Excluir este quadro apaga todas as listas e cartões de forma permanente. Deseja continuar?',
    boardNotFound: 'Quadro não encontrado.',
    superpowers: 'Superpoderes',
    boardColor: 'Cor do quadro',
    renameBoard: 'Renomear quadro',
  },

  lists: {
    add: 'Adicionar lista',
    titlePlaceholder: 'Título da lista',
    addConfirm: 'Adicionar',
    delete: 'Excluir lista',
    deleteConfirm: 'Excluir esta lista e todos os cartões dela?',
    menu: 'Opções da lista',
    archiveCards: 'Arquivar todos os cartões',
    archiveCardsConfirm:
      'Arquivar todos os cartões desta lista? Eles saem do quadro, mas a lista é mantida.',
    archive: 'Arquivar',
    cards: (n: number) => (n === 1 ? '1 cartão' : `${n} cartões`),
  },

  cards: {
    add: 'Adicionar cartão',
    titlePlaceholder: 'Título do cartão',
    addConfirm: 'Adicionar cartão',
    details: 'Detalhes do cartão',
    title: 'Título',
    description: 'Descrição',
    descriptionPlaceholder: 'Adicione mais detalhes…',
    delete: 'Excluir cartão',
    deleteConfirm: 'Excluir este cartão?',
  },

  superpowers: {
    'due-dates': {
      title: 'Datas de entrega',
      description: 'Defina um prazo nos cartões e destaque os atrasados.',
    },
    'color-labels': {
      title: 'Etiquetas coloridas',
      description: 'Marque cartões com cores para agrupá-los e achá-los rápido.',
    },
    dueDate: 'Data de entrega',
    clearDate: 'Remover data',
    labels: 'Etiquetas',
    late: 'Atrasado',
    labelNames: {
      red: 'Vermelha',
      orange: 'Laranja',
      yellow: 'Amarela',
      green: 'Verde',
      teal: 'Turquesa',
      blue: 'Azul',
      purple: 'Roxa',
      pink: 'Rosa',
    } as Record<string, string>,
    paletteNames: {
      ocean: 'Oceano',
      sky: 'Céu',
      mint: 'Menta',
      forest: 'Floresta',
      sunset: 'Pôr do sol',
      rose: 'Rosa',
      violet: 'Violeta',
      graphite: 'Grafite',
    } as Record<string, string>,
  },

  account: {
    title: 'Sua conta',
    profile: 'Perfil',
    saved: 'Alterações salvas.',
    passwordSection: 'Alterar senha',
    currentPassword: 'Senha atual',
    passwordChanged: 'Senha alterada. Outros dispositivos foram desconectados.',
    privacySection: 'Seus dados (LGPD)',
    privacyText:
      'Você pode baixar uma cópia de todos os seus dados ou excluir sua conta definitivamente.',
    export: 'Baixar meus dados',
    exportDone: 'Arquivo gerado.',
    dangerTitle: 'Excluir conta',
    dangerText:
      'Esta ação é permanente: sua conta, quadros, listas e cartões serão apagados e não poderão ser recuperados.',
    deleteConfirmPassword: 'Confirme sua senha para excluir',
    deleteAccount: 'Excluir minha conta',
  },

  footer: {
    privacy: 'Privacidade',
    terms: 'Termos',
  },
};

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (m.errors[code]) return m.errors[code];
  }
  if (error instanceof TypeError) return m.networkError;
  return m.genericError;
}
