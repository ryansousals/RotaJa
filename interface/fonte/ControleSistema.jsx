import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import { api } from './api';
import { Modal, Formulario } from './componentes';
export function ControleSistema() {
    const [cfg, definirCfg] = useState(null), [erro, definirErro] = useState(''), [confirmar, definirConfirmar] = useState(false), [ocupado, definirOcupado] = useState(false);
    useEffect(() => { let ativo = true; const consultar = () => api('/sistema/empresas').then(c => { if (ativo) {
        definirCfg(c);
        definirErro('');
    } }).catch(e => { if (ativo)
        definirErro(e.message); }); consultar(); const t = setInterval(consultar, 30000); return () => { ativo = false; clearInterval(t); }; }, []);
    return <section className="controle-sistema cartao"><div><Power size={20}/><div><strong>Sistema das empresas: {cfg ? cfg.st_emp_lig ? 'ligado' : 'desligado' : 'consultando…'}</strong><p>{cfg?.st_emp_lig ? 'As lojas podem acessar e abrir chamadas.' : 'O acesso das lojas está suspenso. A administração continua disponível.'}</p></div></div><button className={`btn ${cfg?.st_emp_lig ? 'perigo' : 'primario'}`} disabled={!cfg || ocupado} onClick={() => definirConfirmar(true)}>{cfg?.st_emp_lig ? 'Desligar empresas' : 'Ligar empresas'}</button>{erro && <p role="alert">{erro}</p>}
    {confirmar && cfg && <Modal titulo={cfg.st_emp_lig ? 'Desligar todas as empresas?' : 'Ligar todas as empresas?'} fechar={() => definirConfirmar(false)}><Formulario ocupado={ocupado} erro={erro} rotulo="Confirmar alteração" enviar={async () => { definirOcupado(true); definirErro(''); try {
        definirCfg(await api('/sistema/empresas', { st_emp_lig: !cfg.st_emp_lig, versao: cfg.versao }, 'PATCH'));
        definirConfirmar(false);
    }
    catch (e) {
        definirErro(e.message);
        api('/sistema/empresas').then(definirCfg).catch(() => { });
    }
    finally {
        definirOcupado(false);
    } }}><p className="form-linha">{cfg.st_emp_lig ? 'Todas as lojas perderão o acesso ao portal e não poderão abrir chamadas até você religar. Pedidos e entregadores continuam sob controle da administração.' : 'As empresas ativas poderão entrar novamente. Empresas excluídas ou desativadas continuarão bloqueadas.'}</p></Formulario></Modal>}
  </section>;
}
