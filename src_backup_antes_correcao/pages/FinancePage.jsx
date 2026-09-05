import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:3001/api/financeiro';

const STATUS_LABELS = {
  PENDENTE: 'Pendente',
  VENCIDA: 'Vencida',
  PARCIAL: 'Parcial',
  PAGA: 'Paga'
};

const STATUS_CLASSES = {
  PENDENTE: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  VENCIDA: 'border-red-500/30 bg-red-500/10 text-red-300',
  PARCIAL: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  PAGA: 'border-green-500/30 bg-green-500/10 text-green-300'
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('pt-BR');
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getDaysUntil(dateValue) {
  if (!dateValue) return null;

  const today = new Date(`${getToday()}T00:00:00`);
  const date = new Date(`${dateValue}T00:00:00`);

  return Math.round(
    (date.getTime() - today.getTime()) / 86400000
  );
}

function isUpcoming(conta) {
  const days = getDaysUntil(conta.data_vencimento);

  return (
    conta.status !== 'PAGA' &&
    days !== null &&
    days >= 0 &&
    days <= 7
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        STATUS_CLASSES[status] ||
        'border-slate-700 bg-slate-800 text-slate-300'
      }`}
    >
      {STATUS_LABELS[status] || status || '-'}
    </span>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function FinancePage() {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [filtroStatus, setFiltroStatus] = useState('TODAS');
  const [busca, setBusca] = useState('');

  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [mostrarBaixa, setMostrarBaixa] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const [formBaixa, setFormBaixa] = useState({
    valor_pago: '',
    juros: '0',
    multa: '0',
    desconto: '0',
    data_pagamento: getToday(),
    forma_pagamento: '',
    conta_financeira: '',
    observacao: ''
  });

  async function carregarContas() {
    try {
      setLoading(true);
      setErro('');

      const response = await fetch(
        `${API_BASE}/contas-pagar`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Erro ao carregar contas a pagar.'
        );
      }

      setContas(
        Array.isArray(data.contas)
          ? data.contas
          : []
      );
    } catch (error) {
      console.error(error);
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sincronizarNfe() {
    try {
      setSincronizando(true);
      setErro('');
      setSucesso('');

      const response = await fetch(
        `${API_BASE}/sincronizar-nfe`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Erro ao sincronizar NF-e.'
        );
      }

      setSucesso(
        data.criadas > 0
          ? `${data.criadas} conta(s) a pagar criada(s) a partir das NF-e.`
          : 'Financeiro já está sincronizado com as NF-e.'
      );

      await carregarContas();
    } catch (error) {
      console.error(error);
      setErro(error.message);
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => {
    carregarContas();
  }, []);

  const resumo = useMemo(() => {
    const totalPagar = contas
      .filter(item => item.status !== 'PAGA')
      .reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.valor || 0) -
              Number(item.valor_pago || 0)
          ),
        0
      );

    const vencido = contas
      .filter(item => item.status === 'VENCIDA')
      .reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.valor || 0) -
              Number(item.valor_pago || 0)
          ),
        0
      );

    const hoje = contas
      .filter(item => {
        const days = getDaysUntil(
          item.data_vencimento
        );

        return (
          item.status !== 'PAGA' &&
          days === 0
        );
      })
      .reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.valor || 0) -
              Number(item.valor_pago || 0)
          ),
        0
      );

    const proximos = contas
      .filter(isUpcoming)
      .reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.valor || 0) -
              Number(item.valor_pago || 0)
          ),
        0
      );

    const totalPago = contas.reduce(
      (total, item) =>
        total + Number(item.valor_pago || 0),
      0
    );

    const totalPendente = contas.filter(
      item =>
        item.status === 'PENDENTE' ||
        item.status === 'PARCIAL'
    ).length;

    return {
      totalPagar,
      vencido,
      hoje,
      proximos,
      totalPago,
      totalPendente
    };
  }, [contas]);

  const contasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return contas.filter(conta => {
      if (
        filtroStatus === 'PENDENTES' &&
        !['PENDENTE', 'PARCIAL'].includes(
          conta.status
        )
      ) {
        return false;
      }

      if (
        filtroStatus === 'VENCIDAS' &&
        conta.status !== 'VENCIDA'
      ) {
        return false;
      }

      if (
        filtroStatus === 'PAGAS' &&
        conta.status !== 'PAGA'
      ) {
        return false;
      }

      if (
        filtroStatus === 'PROXIMAS' &&
        !isUpcoming(conta)
      ) {
        return false;
      }

      if (!termo) {
        return true;
      }

      return [
        conta.fornecedor_nome,
        conta.fornecedor_cnpj,
        conta.nfe_numero,
        conta.nfe_chave,
        conta.numero_titulo,
        conta.numero_parcela
      ]
        .filter(Boolean)
        .some(value =>
          String(value)
            .toLowerCase()
            .includes(termo)
        );
    });
  }, [contas, filtroStatus, busca]);

  function abrirBaixa(conta) {
    const saldo = Math.max(
      0,
      Number(conta.valor || 0) -
        Number(conta.valor_pago || 0)
    );

    setContaSelecionada(conta);

    setFormBaixa({
      valor_pago: saldo.toFixed(2),
      juros: '0',
      multa: '0',
      desconto: '0',
      data_pagamento: getToday(),
      forma_pagamento:
        conta.forma_pagamento || '',
      conta_financeira:
        conta.conta_financeira || '',
      observacao: ''
    });

    setErro('');
    setSucesso('');
    setMostrarBaixa(true);
  }

  function fecharBaixa() {
    setMostrarBaixa(false);
    setContaSelecionada(null);
  }

  function atualizarCampo(campo, valor) {
    setFormBaixa(prev => ({
      ...prev,
      [campo]: valor
    }));
  }

  async function confirmarBaixa(event) {
    event.preventDefault();

    if (!contaSelecionada) {
      return;
    }

    try {
      setErro('');
      setSucesso('');

      const payload = {
        valor_pago: Number(
          formBaixa.valor_pago || 0
        ),
        juros: Number(
          formBaixa.juros || 0
        ),
        multa: Number(
          formBaixa.multa || 0
        ),
        desconto: Number(
          formBaixa.desconto || 0
        ),
        data_pagamento:
          formBaixa.data_pagamento,
        forma_pagamento:
          formBaixa.forma_pagamento,
        conta_financeira:
          formBaixa.conta_financeira,
        observacao:
          formBaixa.observacao
      };

      const response = await fetch(
        `${API_BASE}/contas-pagar/${contaSelecionada.id}/baixar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Erro ao realizar baixa.'
        );
      }

      fecharBaixa();

      setSucesso(
        data.conta?.status === 'PAGA'
          ? 'Conta paga com sucesso.'
          : `Baixa registrada. Saldo restante: ${formatCurrency(
              data.saldo_restante
            )}.`
      );

      await carregarContas();
    } catch (error) {
      console.error(error);
      setErro(error.message);
    }
  }

  function abrirHistorico(conta) {
    setContaSelecionada(conta);
    setMostrarHistorico(true);
    setErro('');
    setSucesso('');
  }

  function fecharHistorico() {
    setMostrarHistorico(false);
    setContaSelecionada(null);
  }

  const saldoSelecionado = contaSelecionada
    ? Math.max(
        0,
        Number(contaSelecionada.valor || 0) -
          Number(
            contaSelecionada.valor_pago || 0
          )
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-orange-400">
              Finanças
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Financeiro
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Controle de contas a pagar, parcelas,
              vencimentos e baixas financeiras.
            </p>
          </div>

          <button
            type="button"
            onClick={sincronizarNfe}
            disabled={sincronizando}
            className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sincronizando
              ? 'Sincronizando...'
              : '? Sincronizar NF-e'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {sucesso}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title="Total a pagar"
          value={formatCurrency(
            resumo.totalPagar
          )}
          subtitle={`${resumo.totalPendente} conta(s) pendente(s)`}
        />

        <SummaryCard
          title="Vencido"
          value={formatCurrency(
            resumo.vencido
          )}
          subtitle="Contas em atraso"
        />

        <SummaryCard
          title="Vence hoje"
          value={formatCurrency(
            resumo.hoje
          )}
          subtitle="Prioridade de pagamento"
        />

        <SummaryCard
          title="Próximos 7 dias"
          value={formatCurrency(
            resumo.proximos
          )}
          subtitle="Vencimentos próximos"
        />

        <SummaryCard
          title="Total pago"
          value={formatCurrency(
            resumo.totalPago
          )}
          subtitle="Pagamentos registrados"
        />

        <SummaryCard
          title="Contas"
          value={contas.length}
          subtitle="Total cadastrado"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Contas a Pagar
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              NF-e, parcelas e pagamentos registrados.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={busca}
              onChange={event =>
                setBusca(event.target.value)
              }
              placeholder="?? Buscar fornecedor, NF-e ou título..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-500 md:w-80"
            />

            <select
              value={filtroStatus}
              onChange={event =>
                setFiltroStatus(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500"
            >
              <option value="TODAS">
                Todas
              </option>
              <option value="PENDENTES">
                Pendentes
              </option>
              <option value="VENCIDAS">
                Vencidas
              </option>
              <option value="PAGAS">
                Pagas
              </option>
              <option value="PROXIMAS">
                Próximas
              </option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">
                  Fornecedor
                </th>
                <th className="px-3 py-3">
                  NF-e
                </th>
                <th className="px-3 py-3">
                  Parcela
                </th>
                <th className="px-3 py-3">
                  Vencimento
                </th>
                <th className="px-3 py-3 text-right">
                  Valor
                </th>
                <th className="px-3 py-3 text-right">
                  Pago
                </th>
                <th className="px-3 py-3 text-right">
                  Saldo
                </th>
                <th className="px-3 py-3">
                  Status
                </th>
                <th className="px-3 py-3">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Carregando contas a pagar...
                  </td>
                </tr>
              ) : contasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              ) : (
                contasFiltradas.map(conta => {
                  const saldo = Math.max(
                    0,
                    Number(conta.valor || 0) -
                      Number(
                        conta.valor_pago || 0
                      )
                  );

                  return (
                    <tr
                      key={conta.id}
                      className="border-b border-slate-800/70 transition hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-4">
                        <div className="font-medium text-white">
                          {conta.fornecedor_nome ||
                            'Fornecedor não informado'}
                        </div>

                        {conta.fornecedor_cnpj && (
                          <div className="mt-1 text-xs text-slate-500">
                            CNPJ: {conta.fornecedor_cnpj}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-4">
                        <div className="text-white">
                          #{conta.nfe_numero || '-'}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Série {conta.nfe_serie || '-'}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-slate-300">
                        {conta.numero_parcela || '-'}
                      </td>

                      <td className="px-3 py-4">
                        <span
                          className={
                            conta.status === 'VENCIDA'
                              ? 'font-medium text-red-300'
                              : 'text-slate-300'
                          }
                        >
                          {formatDate(
                            conta.data_vencimento
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-4 text-right font-medium text-white">
                        {formatCurrency(
                          conta.valor
                        )}
                      </td>

                      <td className="px-3 py-4 text-right text-green-300">
                        {formatCurrency(
                          conta.valor_pago
                        )}
                      </td>

                      <td className="px-3 py-4 text-right font-medium text-orange-300">
                        {formatCurrency(saldo)}
                      </td>

                      <td className="px-3 py-4">
                        <StatusBadge
                          status={conta.status}
                        />
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex gap-2">
                          {conta.status !==
                            'PAGA' && (
                            <button
                              type="button"
                              onClick={() =>
                                abrirBaixa(conta)
                              }
                              className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-400"
                            >
                              Dar baixa
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              abrirHistorico(conta)
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
                          >
                            Histórico
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="mt-4 text-xs text-slate-500">
            Exibindo {contasFiltradas.length} de{' '}
            {contas.length} conta(s).
          </div>
        )}
      </div>

      {mostrarBaixa &&
        contaSelecionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="border-b border-slate-800 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-orange-400">
                      Baixa financeira
                    </p>

                    <h2 className="mt-1 text-2xl font-semibold text-white">
                      {contaSelecionada.fornecedor_nome}
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      NF-e #{contaSelecionada.nfe_numero}
                      {' é '}
                      Parcela{' '}
                      {contaSelecionada.numero_parcela}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fecharBaixa}
                    className="text-2xl text-slate-500 hover:text-white"
                  >
                    é
                  </button>
                </div>
              </div>

              <form
                onSubmit={confirmarBaixa}
                className="space-y-5 p-6"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs text-slate-400">
                      Valor original
                    </label>

                    <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-white">
                      {formatCurrency(
                        contaSelecionada.valor
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Já pago
                    </label>

                    <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-green-300">
                      {formatCurrency(
                        contaSelecionada.valor_pago
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Saldo
                    </label>

                    <div className="mt-1 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 font-semibold text-orange-300">
                      {formatCurrency(
                        saldoSelecionado
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-xs text-slate-400">
                      Juros
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBaixa.juros}
                      onChange={event =>
                        atualizarCampo(
                          'juros',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Multa
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBaixa.multa}
                      onChange={event =>
                        atualizarCampo(
                          'multa',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Desconto
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBaixa.desconto}
                      onChange={event =>
                        atualizarCampo(
                          'desconto',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Valor pago
                    </label>

                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formBaixa.valor_pago}
                      onChange={event =>
                        atualizarCampo(
                          'valor_pago',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-orange-500/50 bg-slate-950 px-4 py-3 font-semibold text-white outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs text-slate-400">
                      Data do pagamento
                    </label>

                    <input
                      required
                      type="date"
                      value={
                        formBaixa.data_pagamento
                      }
                      onChange={event =>
                        atualizarCampo(
                          'data_pagamento',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Forma de pagamento
                    </label>

                    <select
                      value={
                        formBaixa.forma_pagamento
                      }
                      onChange={event =>
                        atualizarCampo(
                          'forma_pagamento',
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
                    >
                      <option value="">
                        Selecione
                      </option>
                      <option value="PIX">
                        PIX
                      </option>
                      <option value="BOLETO">
                        Boleto
                      </option>
                      <option value="TRANSFERENCIA">
                        Transferência
                      </option>
                      <option value="TED">
                        TED
                      </option>
                      <option value="DINHEIRO">
                        Dinheiro
                      </option>
                      <option value="CARTAO">
                        Cartão
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">
                      Conta financeira
                    </label>

                    <input
                      type="text"
                      value={
                        formBaixa.conta_financeira
                      }
                      onChange={event =>
                        atualizarCampo(
                          'conta_financeira',
                          event.target.value
                        )
                      }
                      placeholder="Ex.: Caixa, Banco..."
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">
                    Observação
                  </label>

                  <textarea
                    rows="3"
                    value={
                      formBaixa.observacao
                    }
                    onChange={event =>
                      atualizarCampo(
                        'observacao',
                        event.target.value
                      )
                    }
                    placeholder="Observações sobre este pagamento..."
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-orange-500"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                  <button
                    type="button"
                    onClick={fecharBaixa}
                    className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400"
                  >
                    Confirmar baixa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {mostrarHistorico &&
        contaSelecionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-800 p-6">
                <div>
                  <p className="text-sm text-orange-400">
                    Histórico financeiro
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {contaSelecionada.fornecedor_nome}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    NF-e #{contaSelecionada.nfe_numero}
                    {' é '}
                    Parcela{' '}
                    {contaSelecionada.numero_parcela}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fecharHistorico}
                  className="text-2xl text-slate-500 hover:text-white"
                >
                  é
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6">
                {!Array.isArray(
                  contaSelecionada.baixas
                ) ||
                contaSelecionada.baixas.length ===
                  0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
                    Nenhuma baixa registrada.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contaSelecionada.baixas.map(
                      (baixa, index) => (
                        <div
                          key={
                            baixa.id ||
                            index
                          }
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">
                              Baixa #{index + 1}
                            </span>

                            <strong className="text-green-300">
                              {formatCurrency(
                                baixa.valor
                              )}
                            </strong>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                            <span>
                              Data:{' '}
                              {formatDate(
                                baixa.data_pagamento
                              )}
                            </span>

                            <span>
                              Forma:{' '}
                              {baixa.forma_pagamento ||
                                '-'}
                            </span>

                            <span>
                              Conta:{' '}
                              {baixa.conta_financeira ||
                                '-'}
                            </span>

                            <span>
                              Juros:{' '}
                              {formatCurrency(
                                baixa.juros
                              )}
                            </span>

                            <span>
                              Multa:{' '}
                              {formatCurrency(
                                baixa.multa
                              )}
                            </span>

                            <span>
                              Desconto:{' '}
                              {formatCurrency(
                                baixa.desconto
                              )}
                            </span>
                          </div>

                          {baixa.observacao && (
                            <div className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
                              {baixa.observacao}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    Total pago
                  </span>

                  <strong className="text-green-300">
                    {formatCurrency(
                      contaSelecionada.valor_pago
                    )}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-400">
                    Saldo
                  </span>

                  <strong className="text-orange-300">
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(
                          contaSelecionada.valor ||
                            0
                        ) -
                          Number(
                            contaSelecionada.valor_pago ||
                              0
                          )
                      )
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}