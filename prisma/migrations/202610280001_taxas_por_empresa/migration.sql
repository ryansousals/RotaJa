CREATE TABLE "tx_taxas_empresas" (
 "id_emp" UUID NOT NULL REFERENCES "emp_empresas"("id_emp"),
 "id_bai" UUID NOT NULL REFERENCES "bai_bairros"("id_bai"),
 "vlr_tx_ent" DECIMAL(12,2) NOT NULL CHECK ("vlr_tx_ent" >= 0),
 "vlr_tx_ret" DECIMAL(12,2) NOT NULL CHECK ("vlr_tx_ret" >= 0),
 PRIMARY KEY ("id_emp", "id_bai")
);
ALTER TABLE "ped_pedidos" ADD COLUMN "tp_pag_prev" "tp_recebimento";
