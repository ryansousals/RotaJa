CREATE TYPE "tp_movimento_caixa" AS ENUM ('TROCO_ENTRADA','TROCO_SAIDA','PARCIAL');
CREATE TABLE "mov_movimentos_caixa" (
 "id_mov" UUID PRIMARY KEY, "id_ab" UUID NOT NULL REFERENCES "ab_aberturas_caixa"("id_ab"),
 "id_usr" UUID NOT NULL REFERENCES "usr_usuarios"("id_usr"), "chave_idem" UUID NOT NULL UNIQUE,
 "tp_mov" "tp_movimento_caixa" NOT NULL,"valores" JSONB NOT NULL,"obs_mov" TEXT NOT NULL,
 "dt_mov" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "mov_movimentos_caixa_id_ab_dt_mov_idx" ON "mov_movimentos_caixa"("id_ab","dt_mov");
CREATE TABLE "ger_fechamentos_caixa" (
 "id_ger" UUID PRIMARY KEY,"dt_ref" DATE NOT NULL UNIQUE,"dt_fec" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "id_usr" UUID NOT NULL REFERENCES "usr_usuarios"("id_usr"),"resumo" JSONB NOT NULL,"obs_ger" TEXT NOT NULL
);
