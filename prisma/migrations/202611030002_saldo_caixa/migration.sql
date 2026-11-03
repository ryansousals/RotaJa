ALTER TABLE "cx_caixa_entregador"
 ADD COLUMN "vlr_fundo_cx" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("vlr_fundo_cx" >= 0),
 ADD COLUMN "vlr_troco_cx" DECIMAL(12,2) NOT NULL DEFAULT 0,
 ADD COLUMN "vlr_parcial_din" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("vlr_parcial_din" >= 0);
ALTER TABLE "cx_caixa_entregador" DROP CONSTRAINT "cx_saldo_consistente";
ALTER TABLE "cx_caixa_entregador" ADD CONSTRAINT "cx_saldo_consistente" CHECK (
 "vlr_saldo_rep_adm" = "vlr_tot_rec_din" - "vlr_tot_ganho" + "vlr_fundo_cx" + "vlr_troco_cx" - "vlr_parcial_din"
);
