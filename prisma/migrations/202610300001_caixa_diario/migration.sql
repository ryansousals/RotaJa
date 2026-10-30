ALTER TYPE "tp_recebimento" ADD VALUE 'ONLINE_LOJA';
ALTER TABLE "cx_caixa_entregador" ADD COLUMN "conferencia" JSONB;
CREATE TABLE "ab_aberturas_caixa" (
 "id_ab" UUID PRIMARY KEY, "id_ent" UUID NOT NULL REFERENCES "ent_entregadores"("id_ent"),
 "dt_ab" TIMESTAMPTZ(3) NOT NULL, "vlr_ab" DECIMAL(12,2) NOT NULL CHECK ("vlr_ab" >= 0),
 "obs_ab" TEXT NOT NULL, "id_usr" UUID NOT NULL REFERENCES "usr_usuarios"("id_usr"),
 "id_cx" UUID UNIQUE REFERENCES "cx_caixa_entregador"("id_cx")
);
CREATE INDEX "ab_aberturas_caixa_id_ent_dt_ab_idx" ON "ab_aberturas_caixa"("id_ent", "dt_ab");
CREATE UNIQUE INDEX "uma_abertura_por_entregador" ON "ab_aberturas_caixa"("id_ent") WHERE "id_cx" IS NULL;
