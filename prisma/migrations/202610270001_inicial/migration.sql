-- CreateEnum
CREATE TYPE "tp_usuario" AS ENUM ('ADMINISTRADOR', 'OPERADOR', 'REMETENTE', 'ENTREGADOR');

-- CreateEnum
CREATE TYPE "tp_pessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "tp_endereco" AS ENUM ('ENTREGA', 'ORIGEM');

-- CreateEnum
CREATE TYPE "st_pagamento" AS ENUM ('PAGO', 'A_RECEBER');

-- CreateEnum
CREATE TYPE "st_pedido" AS ENUM ('PREPARANDO', 'ATRIBUIDO', 'ACEITO', 'EM_COLETA', 'NO_LOCAL', 'EM_ENTREGA', 'EM_RETORNO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "st_caixa" AS ENUM ('PENDENTE', 'AGUARDANDO_VALIDACAO', 'QUITADO');

-- CreateEnum
CREATE TYPE "tp_recebimento" AS ENUM ('DINHEIRO', 'PIX_LOJA', 'CARTAO_LOJA');

-- CreateEnum
CREATE TYPE "st_repasse" AS ENUM ('PENDENTE', 'QUITADO');

-- CreateTable
CREATE TABLE "usr_usuarios" (
    "id_usr" UUID NOT NULL,
    "nom_usr" VARCHAR(150) NOT NULL,
    "eml_usr" VARCHAR(254) NOT NULL,
    "sen_hash" TEXT NOT NULL,
    "tp_usr" "tp_usuario" NOT NULL,
    "st_atv" BOOLEAN NOT NULL DEFAULT true,
    "dt_cad" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_usuarios_pkey" PRIMARY KEY ("id_usr")
);

-- CreateTable
CREATE TABLE "emp_empresas" (
    "id_emp" UUID NOT NULL,
    "id_usr" UUID NOT NULL,
    "tp_pes" "tp_pessoa" NOT NULL,
    "raz_soc" VARCHAR(200) NOT NULL,
    "nom_fan" VARCHAR(150) NOT NULL,
    "doc_emp" VARCHAR(14) NOT NULL,
    "log_emp" TEXT NOT NULL,
    "num_emp" TEXT NOT NULL,
    "cmp_emp" TEXT,
    "bai_emp" TEXT NOT NULL,
    "cid_emp" TEXT NOT NULL,
    "uf_emp" CHAR(2) NOT NULL,
    "tel_emp" TEXT NOT NULL,
    "st_atv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "emp_empresas_pkey" PRIMARY KEY ("id_emp")
);

-- CreateTable
CREATE TABLE "ent_entregadores" (
    "id_ent" UUID NOT NULL,
    "id_usr" UUID NOT NULL,
    "doc_cpf" CHAR(11) NOT NULL,
    "pla_moto" VARCHAR(8) NOT NULL,
    "tel_ent" TEXT NOT NULL,
    "st_atv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ent_entregadores_pkey" PRIMARY KEY ("id_ent")
);

-- CreateTable
CREATE TABLE "bai_bairros" (
    "id_bai" UUID NOT NULL,
    "nom_bai" VARCHAR(120) NOT NULL,
    "cid_bai" VARCHAR(120) NOT NULL,
    "uf_bai" CHAR(2) NOT NULL,
    "vlr_tx_ent" DECIMAL(12,2) NOT NULL,
    "vlr_ganho_ent" DECIMAL(12,2) NOT NULL,
    "vlr_tx_ret" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vlr_ganho_ret" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "st_atv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bai_bairros_pkey" PRIMARY KEY ("id_bai")
);

-- CreateTable
CREATE TABLE "ped_pedidos" (
    "id_ped" UUID NOT NULL,
    "num_ped" SERIAL NOT NULL,
    "id_usr" UUID NOT NULL,
    "id_emp" UUID,
    "id_ent" UUID,
    "id_bai" UUID NOT NULL,
    "id_cx" UUID,
    "id_rep" UUID,
    "chave_idem" VARCHAR(100) NOT NULL,
    "resumo_req" CHAR(64) NOT NULL,
    "nom_dest" TEXT NOT NULL,
    "tel_dest" TEXT NOT NULL,
    "log_dest" TEXT NOT NULL,
    "num_dest" TEXT NOT NULL,
    "cmp_dest" TEXT,
    "ref_dest" TEXT,
    "end_loja" JSONB NOT NULL,
    "tp_end" "tp_endereco" NOT NULL,
    "st_pag" "st_pagamento" NOT NULL,
    "st_ped" "st_pedido" NOT NULL DEFAULT 'PREPARANDO',
    "st_ret" BOOLEAN NOT NULL DEFAULT false,
    "vlr_prod" DECIMAL(12,2) NOT NULL,
    "vlr_tx" DECIMAL(12,2) NOT NULL,
    "vlr_ganho_ent" DECIMAL(12,2) NOT NULL,
    "vlr_cobrar" DECIMAL(12,2) NOT NULL,
    "vlr_rec_din" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vlr_rec_loja" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tp_rec" "tp_recebimento",
    "versao" INTEGER NOT NULL DEFAULT 0,
    "dt_cad" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_alt" TIMESTAMPTZ(3) NOT NULL,
    "dt_conc" TIMESTAMPTZ(3),

    CONSTRAINT "ped_pedidos_pkey" PRIMARY KEY ("id_ped")
);

-- CreateTable
CREATE TABLE "cx_caixa_entregador" (
    "id_cx" UUID NOT NULL,
    "id_ent" UUID NOT NULL,
    "dt_ref" DATE NOT NULL,
    "dt_ini" TIMESTAMPTZ(3) NOT NULL,
    "dt_fim" TIMESTAMPTZ(3) NOT NULL,
    "qtd_peds" INTEGER NOT NULL,
    "vlr_tot_ganho" DECIMAL(12,2) NOT NULL,
    "vlr_tot_rec_din" DECIMAL(12,2) NOT NULL,
    "vlr_saldo_rep_adm" DECIMAL(12,2) NOT NULL,
    "st_cx" "st_caixa" NOT NULL DEFAULT 'PENDENTE',
    "id_usr_val" UUID,
    "dt_val" TIMESTAMPTZ(3),
    "ref_comprovante" TEXT,

    CONSTRAINT "cx_caixa_entregador_pkey" PRIMARY KEY ("id_cx")
);

-- CreateTable
CREATE TABLE "rep_repasses_lojas" (
    "id_rep" UUID NOT NULL,
    "id_emp" UUID NOT NULL,
    "dt_ini" TIMESTAMPTZ(3) NOT NULL,
    "dt_fim" TIMESTAMPTZ(3) NOT NULL,
    "vlr_rep" DECIMAL(12,2) NOT NULL,
    "st_rep" "st_repasse" NOT NULL DEFAULT 'PENDENTE',
    "dt_pag" TIMESTAMPTZ(3),
    "ref_comprovante" TEXT,

    CONSTRAINT "rep_repasses_lojas_pkey" PRIMARY KEY ("id_rep")
);

-- CreateTable
CREATE TABLE "log_historico_pedidos" (
    "id_log" UUID NOT NULL,
    "id_ped" UUID NOT NULL,
    "id_usr" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "dados_ant" JSONB,
    "dados_nov" JSONB NOT NULL,
    "dt_cad" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_historico_pedidos_pkey" PRIMARY KEY ("id_log")
);

-- CreateIndex
CREATE UNIQUE INDEX "usr_usuarios_eml_usr_key" ON "usr_usuarios"("eml_usr");

-- CreateIndex
CREATE UNIQUE INDEX "emp_empresas_id_usr_key" ON "emp_empresas"("id_usr");

-- CreateIndex
CREATE UNIQUE INDEX "emp_empresas_doc_emp_key" ON "emp_empresas"("doc_emp");

-- CreateIndex
CREATE UNIQUE INDEX "ent_entregadores_id_usr_key" ON "ent_entregadores"("id_usr");

-- CreateIndex
CREATE UNIQUE INDEX "ent_entregadores_doc_cpf_key" ON "ent_entregadores"("doc_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "bai_bairros_nom_bai_cid_bai_uf_bai_key" ON "bai_bairros"("nom_bai", "cid_bai", "uf_bai");

-- CreateIndex
CREATE UNIQUE INDEX "ped_pedidos_num_ped_key" ON "ped_pedidos"("num_ped");

-- CreateIndex
CREATE INDEX "ped_pedidos_st_ped_dt_cad_idx" ON "ped_pedidos"("st_ped", "dt_cad");

-- CreateIndex
CREATE INDEX "ped_pedidos_id_emp_dt_cad_idx" ON "ped_pedidos"("id_emp", "dt_cad");

-- CreateIndex
CREATE INDEX "ped_pedidos_id_ent_dt_conc_idx" ON "ped_pedidos"("id_ent", "dt_conc");

-- CreateIndex
CREATE UNIQUE INDEX "ped_pedidos_id_usr_chave_idem_key" ON "ped_pedidos"("id_usr", "chave_idem");

-- CreateIndex
CREATE UNIQUE INDEX "cx_caixa_entregador_id_ent_dt_ini_dt_fim_key" ON "cx_caixa_entregador"("id_ent", "dt_ini", "dt_fim");

-- CreateIndex
CREATE UNIQUE INDEX "rep_repasses_lojas_id_emp_dt_ini_dt_fim_key" ON "rep_repasses_lojas"("id_emp", "dt_ini", "dt_fim");

-- CreateIndex
CREATE INDEX "log_historico_pedidos_id_ped_dt_cad_idx" ON "log_historico_pedidos"("id_ped", "dt_cad");

-- AddForeignKey
ALTER TABLE "emp_empresas" ADD CONSTRAINT "emp_empresas_id_usr_fkey" FOREIGN KEY ("id_usr") REFERENCES "usr_usuarios"("id_usr") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ent_entregadores" ADD CONSTRAINT "ent_entregadores_id_usr_fkey" FOREIGN KEY ("id_usr") REFERENCES "usr_usuarios"("id_usr") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_usr_fkey" FOREIGN KEY ("id_usr") REFERENCES "usr_usuarios"("id_usr") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_emp_fkey" FOREIGN KEY ("id_emp") REFERENCES "emp_empresas"("id_emp") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_ent_fkey" FOREIGN KEY ("id_ent") REFERENCES "ent_entregadores"("id_ent") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_bai_fkey" FOREIGN KEY ("id_bai") REFERENCES "bai_bairros"("id_bai") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_cx_fkey" FOREIGN KEY ("id_cx") REFERENCES "cx_caixa_entregador"("id_cx") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_pedidos_id_rep_fkey" FOREIGN KEY ("id_rep") REFERENCES "rep_repasses_lojas"("id_rep") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cx_caixa_entregador" ADD CONSTRAINT "cx_caixa_entregador_id_ent_fkey" FOREIGN KEY ("id_ent") REFERENCES "ent_entregadores"("id_ent") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cx_caixa_entregador" ADD CONSTRAINT "cx_caixa_entregador_id_usr_val_fkey" FOREIGN KEY ("id_usr_val") REFERENCES "usr_usuarios"("id_usr") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_repasses_lojas" ADD CONSTRAINT "rep_repasses_lojas_id_emp_fkey" FOREIGN KEY ("id_emp") REFERENCES "emp_empresas"("id_emp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_historico_pedidos" ADD CONSTRAINT "log_historico_pedidos_id_ped_fkey" FOREIGN KEY ("id_ped") REFERENCES "ped_pedidos"("id_ped") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_historico_pedidos" ADD CONSTRAINT "log_historico_pedidos_id_usr_fkey" FOREIGN KEY ("id_usr") REFERENCES "usr_usuarios"("id_usr") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes financeiras complementares ao schema Prisma.
ALTER TABLE "bai_bairros" ADD CONSTRAINT "bai_valores_nao_negativos"
CHECK ("vlr_tx_ent" >= 0 AND "vlr_ganho_ent" >= 0 AND "vlr_tx_ret" >= 0 AND "vlr_ganho_ret" >= 0);
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_valores_nao_negativos"
CHECK ("vlr_prod" >= 0 AND "vlr_tx" >= 0 AND "vlr_ganho_ent" >= 0 AND "vlr_cobrar" >= 0 AND "vlr_rec_din" >= 0 AND "vlr_rec_loja" >= 0);
ALTER TABLE "ped_pedidos" ADD CONSTRAINT "ped_conclusao_consistente"
CHECK (("st_ped" = 'CONCLUIDO') = ("dt_conc" IS NOT NULL));
ALTER TABLE "cx_caixa_entregador" ADD CONSTRAINT "cx_periodo_valido" CHECK ("dt_ini" < "dt_fim");
ALTER TABLE "cx_caixa_entregador" ADD CONSTRAINT "cx_saldo_consistente"
CHECK ("vlr_saldo_rep_adm" = "vlr_tot_rec_din" - "vlr_tot_ganho");
ALTER TABLE "rep_repasses_lojas" ADD CONSTRAINT "rep_periodo_valido" CHECK ("dt_ini" < "dt_fim");

