import { useEffect, useState } from 'react';
import { Bike, Building2, MapPinned, Pencil, Plus, Search, ShieldCheck, ToggleLeft, ToggleRight, Trash2, Users } from 'lucide-react';
import { api, reais } from './api';
import { Campo, Formulario, Modal, Selecao, Vazio } from './componentes';
const config = {
    empresas: { titulo: 'Empresas parceiras', descricao: 'Gerencie as lojas que fazem parte da sua operação.', singular: 'empresa', icone: Building2 },
    entregadores: { titulo: 'Entregadores', descricao: 'Sua equipe na rua, conectada à central.', singular: 'entregador', icone: Bike },
    bairros: { titulo: 'Bairros e tarifas', descricao: 'Defina as áreas atendidas e os valores de cada entrega.', singular: 'bairro', icone: MapPinned },
    usuarios: { titulo: 'Usuários e acessos', descricao: 'Controle quem pode acessar a plataforma e seus perfis.', singular: 'usuário', icone: Users },
};
const perfil = { ADMINISTRADOR: 'Administrador', OPERADOR: 'Operador', REMETENTE: 'Cliente / Remetente', ENTREGADOR: 'Entregador' };
export function Cadastros({ pagina, usuario, avisar, atualizar, revisao }) {
    const [itens, definirItens] = useState([]), [busca, definirBusca] = useState(''), [erro, definirErro] = useState(''), [carregando, definirCarregando] = useState(true);
    const [form, definirForm] = useState(null), [ocupado, definirOcupado] = useState(false);
    const [excluir, definirExcluir] = useState(null);
    const [tarifas, definirTarifas] = useState(null);
    const c = config[pagina], Icone = c.icone;
    useEffect(() => { definirBusca(''); definirForm(null); }, [pagina]);
    useEffect(() => { let ativo = true; definirCarregando(true); api('/' + pagina).then(v => { if (ativo) {
        definirItens(v);
        definirErro('');
    } }).catch(e => { if (ativo)
        definirErro(e.message); }).finally(() => { if (ativo)
        definirCarregando(false); }); return () => { ativo = false; }; }, [pagina, revisao]);
    const filtrados = itens.filter(r => JSON.stringify(r).toLowerCase().includes(busca.toLowerCase()));
    async function alternar(r) {
        definirOcupado(true);
        try {
            const id = 'id_emp' in r ? r.id_emp : 'id_ent' in r ? r.id_ent : 'id_bai' in r ? r.id_bai : r.id_usr;
            await api(`/${pagina}/${id}`, { st_atv: !r.st_atv }, 'PATCH');
            atualizar();
            avisar(r.st_atv ? 'Cadastro desativado.' : 'Cadastro ativado.');
        }
        catch (e) {
            avisar(e.message, true);
        }
        finally {
            definirOcupado(false);
        }
    }
    return <><div className="pagina-titulo"><div><span className="sobretitulo">GESTÃO DA SUA REDE</span><h1>{c.titulo}</h1><p>{c.descricao}</p></div>{(pagina !== 'bairros' || usuario.tp_usr === 'ADMINISTRADOR') && <button className="btn primario" onClick={() => definirForm({})}><Plus size={17}/>Cadastrar {c.singular}</button>}</div><div className="cadastro-resumo"><span className="resumo-icone"><Icone size={22}/></span><div><strong>{itens.length} {c.titulo.toLowerCase()}</strong><small>{itens.filter(r => r.st_atv).length} ativos na sua central</small></div><ShieldCheck size={20}/><span>Cadastro controlado pela operação</span></div>
    <section className="cartao"><div className="secao-cab"><h2>Todos os registros <span className="contador">{filtrados.length}</span></h2><label className="pesquisa"><Search size={16}/><input value={busca} onChange={e => definirBusca(e.target.value)} placeholder={`Buscar ${c.singular}`} aria-label={`Buscar ${c.singular}`}/></label></div>{erro && <p className="aviso erro" role="alert">{erro}</p>}
    <div className="tabela-scroll"><table><thead><tr>{(pagina === 'empresas' ? ['Empresa', 'CPF / CNPJ', 'Endereço', 'Contato', 'Situação', 'Ações'] : pagina === 'entregadores' ? ['Entregador', 'Placa', 'Telefone', 'Situação', 'Ações'] : pagina === 'bairros' ? ['Bairro', 'Cidade', 'Frete', 'Ganho motoboy', 'Com retorno / ganho', 'Situação', 'Ações'] : ['Usuário', 'E-mail', 'Perfil', 'Situação', 'Ações']).map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{filtrados.map(r => {
            const id = 'id_emp' in r ? r.id_emp : 'id_ent' in r ? r.id_ent : 'id_bai' in r ? r.id_bai : r.id_usr;
            const protegido = pagina === 'bairros' && usuario.tp_usr !== 'ADMINISTRADOR' || pagina === 'usuarios' && (r.tp_usr === 'ADMINISTRADOR' || r.id_usr === usuario.id_usr || r.tp_usr === 'OPERADOR' && usuario.tp_usr !== 'ADMINISTRADOR');
            return <tr key={id}>{pagina === 'empresas' ? <><td><strong>{r.nom_fan}</strong><small className="celula-detalhe">{r.raz_soc}</small></td><td>{r.doc_emp}</td><td>{r.log_emp}, {r.num_emp}<small className="celula-detalhe">{r.bai_emp} · {r.cid_emp}</small></td><td>{r.tel_emp}</td></> : pagina === 'entregadores' ? <><td><strong>{r.usuario.nom_usr}</strong><small className="celula-detalhe">{r.usuario.eml_usr}</small></td><td><span className="placa">{r.pla_moto}</span></td><td>{r.tel_ent}</td></> : pagina === 'bairros' ? <><td><strong>{r.nom_bai}</strong></td><td>{r.cid_bai} / {r.uf_bai}</td><td>{r.st_sob_consulta ? "Sob consulta" : reais(r.vlr_tx_ent)}</td><td>{reais(r.vlr_ganho_ent)}</td><td>{r.st_sob_consulta ? "Sob consulta" : reais(Number(r.vlr_tx_ent) * 2)} / {reais(Number(r.vlr_ganho_ent) * 2)}</td></> : <><td><strong>{r.nom_usr}</strong></td><td>{r.eml_usr}</td><td>{perfil[r.tp_usr]}</td></>}
      <td><span className={`badge ${r.st_atv ? 'verde' : 'neutro'}`}><i />{r.st_atv ? 'Ativo' : 'Inativo'}</span></td><td><div className="acoes">{['empresas', 'entregadores', 'bairros'].includes(pagina) && usuario.tp_usr === 'ADMINISTRADOR' && <button className="icone" aria-label={`Excluir ${c.singular} ${'id_emp' in r ? r.nom_fan : 'id_bai' in r ? r.nom_bai : r.usuario.nom_usr}`} title={`Excluir ${c.singular}`} onClick={() => { definirErro(''); definirExcluir(r); }}><Trash2 size={17}/></button>}{pagina === 'empresas' && usuario.tp_usr === 'ADMINISTRADOR' && <button className="btn" onClick={() => definirTarifas(r)}>Taxas por bairro</button>}{pagina !== 'usuarios' && !protegido && <button className="icone" title="Editar cadastro" aria-label={`Editar ${c.singular}`} onClick={() => definirForm({ registro: r })}><Pencil size={16}/></button>}<button className="icone" title={r.st_atv ? 'Desativar cadastro' : 'Ativar cadastro'} aria-label={r.st_atv ? `Desativar ${c.singular}` : `Ativar ${c.singular}`} disabled={protegido || ocupado} onClick={() => alternar(r)}>{r.st_atv ? <ToggleRight size={22}/> : <ToggleLeft size={22}/>}</button></div></td></tr>;
        })}</tbody></table></div>{!filtrados.length && !carregando && <Vazio titulo={`Nenhum ${c.singular} encontrado`} texto="Cadastre sua rede para começar a operar."/>}{carregando && !itens.length && <p className="carregando">Carregando cadastros…</p>}<div className="tabela-rodape"><span>{filtrados.length} registros nesta lista</span><span>RotaJá · Cadastros</span></div></section>
    {excluir && <Modal titulo={`Excluir ${c.singular}`} subtitulo={'id_emp' in excluir ? excluir.nom_fan : 'id_bai' in excluir ? excluir.nom_bai : excluir.usuario.nom_usr} fechar={() => definirExcluir(null)}><Formulario erro={erro} ocupado={ocupado} rotulo="Confirmar exclusão" enviar={async () => { definirOcupado(true); definirErro(''); try {
        await api('id_emp' in excluir ? '/empresas/' + excluir.id_emp : 'id_bai' in excluir ? '/bairros/' + excluir.id_bai : '/entregadores/' + excluir.id_ent, undefined, 'DELETE');
        definirExcluir(null);
        atualizar();
        avisar('Cadastro excluído da operação. Histórico preservado.');
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><p className="form-linha">Tem certeza que deseja excluir o cadastro {'id_emp' in excluir ? excluir.nom_fan : 'id_bai' in excluir ? excluir.nom_bai : excluir.usuario.nom_usr}? {'id_bai' in excluir ? 'O bairro será removido das novas chamadas e das listas de taxas de todas as lojas. Pedidos existentes e seus valores serão preservados.' : 'O acesso será bloqueado e o histórico preservado. Entregadores com caixa aberto, entregas em andamento ou pendências financeiras não podem ser excluídos.'}</p></Formulario></Modal>}
    {tarifas && <TarifasEmpresa empresa={tarifas} fechar={() => definirTarifas(null)}/>}
    {form && <CadastroForm pagina={pagina} registro={form.registro} usuario={usuario} fechar={() => definirForm(null)} pronto={() => { definirForm(null); atualizar(); avisar('Cadastro salvo com sucesso.'); }}/>}
  </>;
}
export function CadastroForm({ pagina, registro, usuario, fechar, pronto }) {
    const [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    const c = config[pagina], emp = registro, ent = registro, bai = registro;
    const credenciais = !registro && ['empresas', 'entregadores'].includes(pagina);
    return <Modal titulo={`${registro ? 'Editar' : 'Cadastrar'} ${c.singular}`} subtitulo={credenciais ? 'O acesso do parceiro será criado junto com este cadastro.' : 'Mantenha os dados da sua operação atualizados.'} fechar={fechar} largo><Formulario erro={erro} ocupado={ocupado} enviar={async (d) => {
            definirOcupado(true);
            definirErro('');
            try {
                const id = registro ? 'id_emp' in registro ? registro.id_emp : 'id_ent' in registro ? registro.id_ent : 'id_bai' in registro ? registro.id_bai : registro.id_usr : '';
                const rota = registro ? `/${pagina}/${id}` : pagina === 'empresas' ? '/cadastros/empresa' : pagina === 'entregadores' ? '/cadastros/entregador' : '/' + pagina;
                await api(rota, { ...d, ...(pagina === 'bairros' ? { st_sob_consulta: d.st_sob_consulta === 'true', vlr_tx_ret: d.vlr_tx_ent, vlr_ganho_ret: d.vlr_ganho_ent } : {}), ...(registro && pagina === 'entregadores' ? { st_atv: registro.st_atv } : {}) }, registro ? 'PATCH' : 'POST');
                pronto();
            }
            catch (e) {
                definirErro(e.message);
            }
            finally {
                definirOcupado(false);
            }
        }}>
    {(credenciais || pagina === 'usuarios') && <><div className="form-secao"><ShieldCheck size={16}/>Dados de acesso</div><Campo titulo="Nome do responsável" nome="nom_usr"/><Campo titulo="E-mail de acesso" nome="eml_usr" tipo="email"/><Campo titulo="Senha inicial (mínimo 16 caracteres)" nome="senha" tipo="password" padrao=".{16,100}"/>{pagina === 'usuarios' && <Selecao titulo="Perfil de acesso" nome="tp_usr" valor="REMETENTE"><option value="REMETENTE">Cliente / Remetente</option><option value="ENTREGADOR">Entregador</option>{usuario.tp_usr === 'ADMINISTRADOR' && <option value="OPERADOR">Operador</option>}</Selecao>}<div className="aviso">Compartilhe os dados de acesso com o responsável por um canal seguro.{pagina === 'usuarios' ? ' Para criar usuário e perfil de parceiro juntos, use os cadastros de empresas ou entregadores.' : ''}</div></>}
    {pagina === 'empresas' && <><div className="form-secao"><Building2 size={16}/>Dados da empresa</div><Campo titulo="Nome fantasia" nome="nom_fan" valor={emp?.nom_fan}/><Campo titulo="Razão social / Nome completo" nome="raz_soc" valor={emp?.raz_soc}/><Selecao titulo="Tipo de pessoa" nome="tp_pes" valor={emp?.tp_pes ?? 'JURIDICA'}><option value="JURIDICA">Pessoa jurídica</option><option value="FISICA">Pessoa física</option></Selecao><Campo titulo="CPF ou CNPJ (somente números)" nome="doc_emp" valor={emp?.doc_emp} padrao="[0-9]{11}|[0-9]{14}"/><Campo titulo="Telefone com DDD" nome="tel_emp" valor={emp?.tel_emp} padrao="[+]?[0-9]{10,15}"/><Campo titulo="Rua / Logradouro" nome="log_emp" valor={emp?.log_emp}/><Campo titulo="Número" nome="num_emp" valor={emp?.num_emp}/><Campo titulo="Complemento" nome="cmp_emp" valor={emp?.cmp_emp} obrigatorio={false}/><Campo titulo="Bairro da loja" nome="bai_emp" valor={emp?.bai_emp}/><Campo titulo="Cidade" nome="cid_emp" valor={emp?.cid_emp}/><Campo titulo="UF" nome="uf_emp" valor={emp?.uf_emp} padrao="[A-Z]{2}"/></>}
    {pagina === 'entregadores' && <><div className="form-secao"><Bike size={16}/>Dados do entregador</div>{!registro && <Campo titulo="CPF (somente números)" nome="doc_cpf" padrao="[0-9]{11}"/>}<Campo titulo="Placa da moto" nome="pla_moto" valor={ent?.pla_moto}/><Campo titulo="Telefone com DDD" nome="tel_ent" valor={ent?.tel_ent} padrao="[+]?[0-9]{10,15}"/></>}
    {pagina === 'bairros' && <><Campo titulo="Nome do bairro" nome="nom_bai" valor={bai?.nom_bai}/>{!registro && <><Campo titulo="Cidade" nome="cid_bai"/><Campo titulo="UF" nome="uf_bai" padrao="[A-Z]{2}"/></>}<div className="form-secao">Valores da entrega</div><Selecao titulo="Definição da taxa" nome="st_sob_consulta" valor={String(bai?.st_sob_consulta ?? false)}><option value="false">Taxa definida</option><option value="true">Sob consulta</option></Selecao><Campo titulo="Taxa cobrada do cliente (R$)" nome="vlr_tx_ent" tipo="number" passo="0.01" min="0" valor={bai?.vlr_tx_ent ?? '7.00'}/><Campo titulo="Ganho do motoboy (R$)" nome="vlr_ganho_ent" tipo="number" passo="0.01" min="0" valor={bai?.vlr_ganho_ent ?? '7.00'}/><p className="aviso">Com retorno, a taxa e o ganho são dobrados automaticamente.</p><div className="aviso">As novas tarifas valem para os próximos pedidos. Valores de pedidos existentes são preservados.</div></>}
  </Formulario></Modal>;
}
function TarifasEmpresa({ empresa, fechar }) {
    const [bairros, definirBairros] = useState([]);
    const [erro, definirErro] = useState(''), [mensagem, definirMensagem] = useState(''), [ocupado, definirOcupado] = useState(false), [bairro, definirBairro] = useState('');
    const carregar = () => api(`/empresas/${empresa.id_emp}/tarifas`).then(definirBairros);
    useEffect(() => { carregar().catch(e => definirErro(e.message)); }, [empresa.id_emp]);
    const b = bairros.find(b => b.id_bai === bairro);
    return <Modal titulo={`Taxas · ${empresa.nom_fan}`} subtitulo="Todos os bairros estão disponíveis. Personalize os valores desta loja." fechar={fechar}>
    <Selecao titulo="Bairro" nome="bairro_tarifa" mudar={v => { definirBairro(v); definirMensagem(''); }}><option value="" disabled>Selecione um bairro</option>{bairros.map(b => <option key={b.id_bai} value={b.id_bai}>{b.nom_bai}{b.st_atv ? '' : ' (inativo)'}</option>)}</Selecao>
    {b && <Formulario key={b.id_bai} ocupado={ocupado} erro={erro} rotulo="Salvar taxas da loja" enviar={async (d) => {
                definirOcupado(true);
                definirErro('');
                definirMensagem('');
                try {
                    await api(`/empresas/${empresa.id_emp}/tarifas/${b.id_bai}`, { ...d, vlr_tx_ret: d.vlr_tx_ent }, 'PUT');
                    await carregar();
                    definirMensagem('Taxas desta loja atualizadas. Pedidos existentes foram preservados.');
                }
                catch (e) {
                    definirErro(e.message);
                }
                finally {
                    definirOcupado(false);
                }
            }}><div className="aviso">{b.personalizada ? 'Taxa específica desta loja.' : 'Usando a taxa padrão do bairro.'}</div><Campo titulo="Taxa de entrega (R$)" nome="vlr_tx_ent" tipo="number" min="0" passo="0.01" valor={b.vlr_tx_ent}/><p className="aviso">Com retorno, o total é o dobro da taxa definida acima.</p></Formulario>}
    {mensagem && <p role="status" className="aviso">{mensagem}</p>}{!b && erro && <p role="alert">{erro}</p>}
  </Modal>;
}
